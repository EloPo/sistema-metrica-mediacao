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
  greatest(0, (extract(epoch from (coalesce(a.fim, now()) - a.inicio)) * 1000)::bigint - a.pausa_ms) as liquido_ms
from atividades a
join usuarios u on u.id = a.usuario_id;

-- Ajustes da versão 2 (rodar migrar de novo aplica sem perder dados) -------
alter table usuarios  add column if not exists email         text;
alter table usuarios  add column if not exists carga_semanal integer not null default 40;
alter table sessoes   add column if not exists online        boolean not null default false;
alter table sessoes   add column if not exists saiu_em       timestamptz;
