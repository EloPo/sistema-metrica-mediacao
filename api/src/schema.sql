-- Estrutura do banco. Rode com: npm run migrar

create table if not exists usuarios (
  id            serial primary key,
  nome          text not null,
  usuario       text not null unique,          -- nome.sobrenome
  senha_hash    text not null,
  papel         text not null default 'mediador' check (papel in ('mediador','gestor')),
  equipe        text default 'Mediação',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table if not exists atividades (
  id            text primary key,              -- id gerado na extensão (idempotente)
  usuario_id    integer not null references usuarios(id) on delete cascade,
  tipo          text not null,
  titulo        text not null,
  observacao    text not null default '',
  inicio        timestamptz not null,
  fim           timestamptz,
  pausa_ms      bigint not null default 0,
  pausas        jsonb not null default '[]'::jsonb,
  estado        text not null default 'andamento'
                check (estado in ('andamento','pausada','concluida')),
  origem        text not null default 'extensao',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_atividades_usuario on atividades (usuario_id);
create index if not exists idx_atividades_inicio  on atividades (inicio);
create index if not exists idx_atividades_estado  on atividades (estado);

-- Registro de presença: última vez que a extensão de cada pessoa falou com a API.
create table if not exists sessoes (
  usuario_id    integer primary key references usuarios(id) on delete cascade,
  visto_em      timestamptz not null default now(),
  em_pausa      boolean not null default false,
  motivo_pausa  text
);

-- Tempo líquido = do início ao fim, menos as pausas. Atividade aberta conta até agora.
create or replace view v_atividades as
select
  a.id,
  a.usuario_id,
  u.nome,
  u.usuario,
  u.equipe,
  a.tipo,
  a.titulo,
  a.observacao,
  a.inicio,
  a.fim,
  a.pausa_ms,
  a.estado,
  a.atualizado_em,
  greatest(0, (extract(epoch from (coalesce(a.fim, now()) - a.inicio)) * 1000)::bigint - a.pausa_ms) as liquido_ms,
  a.encerrado_por,
  (select g.nome from usuarios g where g.id = a.encerrado_por) as encerrado_por_nome,
  a.origem,
  a.editado_em,
  (select g.nome from usuarios g where g.id = a.editado_por) as editado_por_nome,
  (select g.nome from usuarios g where g.id = a.criado_por) as criado_por_nome
from atividades a
join usuarios u on u.id = a.usuario_id;

-- Ajustes da versão 2 (rodar migrar de novo aplica sem perder dados) -------
alter table usuarios  add column if not exists email         text;
alter table usuarios  add column if not exists carga_semanal integer not null default 40;
alter table sessoes   add column if not exists online        boolean not null default false;
alter table sessoes   add column if not exists saiu_em       timestamptz;

-- Ajustes da versão 3: jornada real x esforço por demanda ------------------
-- Quantos dias por semana a pessoa cumpre a carga (5 = segunda a sexta).
alter table usuarios  add column if not exists dias_semana   integer not null default 5;

-- Jornada real por pessoa e por dia.
--
-- A mediação atende várias demandas ao mesmo tempo, então somar a duração de
-- cada uma conta a mesma hora de trabalho várias vezes.
--
-- A regra é: um instante conta como trabalhado se havia PELO MENOS UMA demanda
-- rodando nele. Por isso cada demanda primeiro desconta as próprias pausas, e
-- só depois os períodos de todas elas são unidos. Assim, pausar um atendimento
-- enquanto outro segue não tira tempo da jornada; só a pausa geral (almoço,
-- café), que para tudo ao mesmo tempo, tira.
--
-- jornada_ms = tempo real de trabalho, sem sobreposição  (serve para a carga horária)
-- esforco_ms = soma do tempo de cada demanda             (serve para medir dedicação)
-- pausa_ms   = tempo com demanda aberta e tudo parado
-- Versão 4: o dia é calculado no fuso de São Paulo, explicitamente. Através do
-- pooler do Supabase a sessão é UTC, e `inicio::date` fazia o dia virar às 21h
-- local, jogando as demandas da noite para o dia seguinte.
create or replace view v_jornada as
with por_demanda as (
  select
    a.usuario_id,
    (a.inicio at time zone 'America/Sao_Paulo')::date as dia,
    tstzmultirange(tstzrange(a.inicio, greatest(coalesce(a.fim, now()), a.inicio), '[]')) as janela,
    tstzmultirange(tstzrange(a.inicio, greatest(coalesce(a.fim, now()), a.inicio), '[]'))
      - coalesce((
          select range_agg(tstzrange(x.ini, x.fim, '[]'))
            from jsonb_array_elements(coalesce(a.pausas, '[]'::jsonb)) p
            cross join lateral (
              select to_timestamp((p ->> 'inicio')::numeric / 1000.0) as ini,
                     greatest(
                       to_timestamp((p ->> 'inicio')::numeric / 1000.0),
                       coalesce(to_timestamp((p ->> 'fim')::numeric / 1000.0), now())
                     ) as fim
            ) x
        ), '{}'::tstzmultirange) as ativo
  from atividades a
),
unidos as (
  select d.usuario_id, d.dia,
         range_agg(r) filter (where r is not null) as trabalhando
    from por_demanda d
    left join lateral unnest(d.ativo) r on true
   group by 1, 2
),
janelas as (
  select d.usuario_id, d.dia, range_agg(r) as ocupado
    from por_demanda d
    cross join lateral unnest(d.janela) r
   group by 1, 2
),
somas as (
  select a.usuario_id,
         (a.inicio at time zone 'America/Sao_Paulo')::date as dia,
         count(*)::int as tarefas,
         count(*) filter (where a.estado = 'concluida')::int as concluidas,
         count(*) filter (where a.estado <> 'concluida')::int as abertas,
         coalesce(sum(greatest(0,
           (extract(epoch from (coalesce(a.fim, now()) - a.inicio)) * 1000)::bigint - a.pausa_ms
         )), 0)::bigint as esforco_ms,
         min(a.inicio) as primeiro,
         max(coalesce(a.fim, now())) as ultimo
    from atividades a
   group by 1, 2
)
select
  s.usuario_id,
  s.dia,
  s.tarefas,
  s.concluidas,
  s.abertas,
  s.esforco_ms,
  (extract(epoch from s.primeiro) * 1000)::bigint as primeiro_ms,
  (extract(epoch from s.ultimo) * 1000)::bigint as ultimo_ms,
  -- least() é uma trava de segurança: a jornada jamais pode passar da soma do
  -- tempo das demandas, nem quando um registro antigo veio com a pausa gravada
  -- só em minutos, sem os horários de início e fim.
  least(
    coalesce((
      select sum(extract(epoch from (upper(r) - lower(r))) * 1000)::bigint
        from unnest(u.trabalhando) r
    ), 0),
    s.esforco_ms
  ) as jornada_ms,
  -- Tempo com demanda aberta e nada rodando: a pausa que o dia realmente teve.
  greatest(0,
    coalesce((
      select sum(extract(epoch from (upper(r) - lower(r))) * 1000)::bigint
        from unnest(j.ocupado) r
    ), 0)
    - coalesce((
      select sum(extract(epoch from (upper(r) - lower(r))) * 1000)::bigint
        from unnest(u.trabalhando) r
    ), 0)
  ) as pausa_ms
from somas s
join janelas j on j.usuario_id = s.usuario_id and j.dia = s.dia
left join unidos u on u.usuario_id = s.usuario_id and u.dia = s.dia;

-- Versão 5: a coordenação pode encerrar o expediente de um mediador que
-- esqueceu demandas abertas.
--
-- `encerrado_por` guarda quem fechou, para a pessoa saber que não foi ela.
-- `desligado_em` invalida os tokens emitidos antes desse instante, o que faz a
-- extensão daquele mediador cair no próximo envio e pedir a senha de novo.
alter table atividades add column if not exists encerrado_por integer references usuarios(id);
alter table usuarios   add column if not exists desligado_em  timestamptz;

-- Versão 7: rastrear quem mexeu em cada demanda e permitir o CRUD pela coordenação.
--
-- `origem` já existia ('extensao'). Agora também vale 'manual' (o mediador
-- lançou à mão no relatório) e 'coordenacao' (a coordenação lançou pelo painel).
-- `editado_em`/`editado_por` dizem quando e por quem a demanda foi alterada
-- depois de criada. Sem isso não há como saber se um número foi digitado ou
-- medido pelo cronômetro.
alter table atividades add column if not exists editado_em  timestamptz;
alter table atividades add column if not exists editado_por integer references usuarios(id);
alter table atividades add column if not exists criado_por  integer references usuarios(id);

create index if not exists idx_atividades_editado on atividades (editado_em);
