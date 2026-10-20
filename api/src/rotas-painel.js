import { Router } from "express";
import { consulta } from "./db.js";
import { exigirLogin, exigirGestor } from "./auth.js";
import { inscrever, totalInscritos, avisar } from "./eventos.js";
import { assinc } from "./assinc.js";
import { dataLocal, horaLocal, hojeLocal } from "./fuso.js";

export const rotasPainel = Router();
rotasPainel.use(exigirLogin, exigirGestor);

// Filtro padrão das consultas por atividade: $1 = de, $2 = até, $3 = mediador.
// O recorte de datas usa o dia local, não o fuso da sessão do banco.
const FILTRO = `${dataLocal("inicio")} between $1::date and $2::date
                and ($3::int is null or usuario_id = $3::int)`;

// A grade é a base de tudo que envolve carga horária: uma linha por mediador e
// por dia do período, com a meta daquele dia e a jornada real.
// Dias sem registro aparecem com jornada zero, senão a falta ficaria invisível.
const GRADE = `
  with dias as (
    select generate_series($1::date, $2::date, interval '1 day')::date as dia
  ),
  pessoas as (
    select id, nome, usuario, email, carga_semanal, dias_semana
      from usuarios
     where ativo and papel = 'mediador' and ($3::int is null or id = $3::int)
  ),
  grade as (
    select p.*, d.dia,
           case when extract(isodow from d.dia) <= p.dias_semana
                then round(p.carga_semanal::numeric / p.dias_semana * 3600000)::bigint
                else 0 end as meta_ms
      from pessoas p cross join dias d
  )
  select g.id as usuario_id, g.nome, g.usuario, g.carga_semanal, g.dias_semana,
         to_char(g.dia, 'YYYY-MM-DD') as dia,
         g.meta_ms,
         coalesce(j.jornada_ms, 0) as jornada_ms,
         coalesce(j.esforco_ms, 0) as esforco_ms,
         coalesce(j.pausa_ms, 0) as pausa_ms,
         coalesce(j.tarefas, 0) as tarefas,
         coalesce(j.concluidas, 0) as concluidas,
         j.primeiro_ms, j.ultimo_ms
    from grade g
    left join v_jornada j on j.usuario_id = g.id and j.dia = g.dia`;

function parametros(req) {
  const hoje = hojeLocal();
  const de = req.query.de || hoje;
  const ate = req.query.ate || de;
  const usuarioId = req.query.usuario ? Number(req.query.usuario) : null;
  return [de, ate, Number.isFinite(usuarioId) ? usuarioId : null];
}

// Lista de gente para o seletor do painel.
rotasPainel.get("/mediadores", assinc(async (_req, res) => {
  const { rows } = await consulta(
    `select id, nome, usuario, equipe, carga_semanal, dias_semana
       from usuarios where ativo and papel = 'mediador' order by nome`,
  );
  res.json({ mediadores: rows });
}));

// Tudo o que o painel desenha, em uma chamada só.
rotasPainel.get("/", assinc(async (req, res) => {
  const p = parametros(req);

  const [grade, porTipo, contagens, presenca, porHora, emAndamento, recentes, extremos] =
    await Promise.all([
      // Jornada, meta e produção por mediador e por dia.
      consulta(`${GRADE} order by g.dia desc, g.nome`, p),

      // Esforço por tipo de demanda: aqui somar está certo, é tempo dedicado.
      consulta(
        `select tipo,
                count(*)::int as tarefas,
                coalesce(sum(liquido_ms), 0) as esforco_ms,
                coalesce(avg(liquido_ms), 0)::bigint as media_ms
           from v_atividades where ${FILTRO}
          group by tipo order by esforco_ms desc`,
        p,
      ),

      // Contagem de demandas por mediador, separada por tipo.
      consulta(
        `select usuario_id,
                count(*)::int as tarefas,
                count(*) filter (where estado = 'concluida')::int as concluidas,
                count(*) filter (where estado <> 'concluida')::int as abertas,
                count(*) filter (where tipo = 'atendimento')::int as atendimentos,
                count(*) filter (where tipo = 'chamado')::int as chamados,
                count(*) filter (where tipo = 'aula')::int as aulas,
                count(*) filter (where tipo = 'disciplina')::int as disciplinas,
                count(*) filter (where tipo = 'outro')::int as outros,
                coalesce(avg(liquido_ms) filter (where estado = 'concluida'), 0)::bigint as media_ms
           from v_atividades where ${FILTRO}
          group by usuario_id`,
        p,
      ),

      consulta(
        `select u.id,
                (extract(epoch from s.visto_em) * 1000)::bigint as visto_em,
                coalesce(s.em_pausa, false) as em_pausa,
                s.motivo_pausa,
                coalesce(s.online, false) as online
           from usuarios u left join sessoes s on s.usuario_id = u.id
          where u.ativo and u.papel = 'mediador'`,
      ),

      consulta(
        `select ${horaLocal("inicio")} as hora,
                count(*)::int as tarefas
           from v_atividades where ${FILTRO}
          group by 1 order by 1`,
        p,
      ),

      consulta(
        `select id, nome, usuario, tipo, titulo, estado,
                (extract(epoch from inicio) * 1000)::bigint as inicio,
                pausa_ms, liquido_ms
           from v_atividades
          where estado <> 'concluida' and ($1::int is null or usuario_id = $1::int)
          order by inicio`,
        [p[2]],
      ),

      consulta(
        `select id, nome, usuario, tipo, titulo, observacao, estado,
                (extract(epoch from inicio) * 1000)::bigint as inicio,
                case when fim is null then null else (extract(epoch from fim) * 1000)::bigint end as fim,
                pausa_ms, liquido_ms, encerrado_por_nome
           from v_atividades where ${FILTRO}
          order by inicio desc limit 400`,
        p,
      ),

      consulta(
        `select coalesce(max(liquido_ms), 0) as maior_ms,
                coalesce(avg(liquido_ms) filter (where estado = 'concluida'), 0)::bigint as media_ms
           from v_atividades where ${FILTRO}`,
        p,
      ),
    ]);

  // Linhas da grade que não interessam: dia sem meta e sem nada registrado
  // (fim de semana vazio, por exemplo).
  const porMediadorDia = grade.rows.filter((l) => l.meta_ms > 0 || l.tarefas > 0);

  const estado = new Map(presenca.rows.map((s) => [s.id, s]));
  const porTipoDeCada = new Map(contagens.rows.map((c) => [c.usuario_id, c]));
  const juntos = new Map();

  for (const l of grade.rows) {
    if (!juntos.has(l.usuario_id)) {
      const s = estado.get(l.usuario_id) || {};
      const c = porTipoDeCada.get(l.usuario_id) || {};
      juntos.set(l.usuario_id, {
        id: l.usuario_id,
        nome: l.nome,
        usuario: l.usuario,
        carga_semanal: l.carga_semanal,
        dias_semana: l.dias_semana,
        meta_ms: 0,
        jornada_ms: 0,
        esforco_ms: 0,
        pausa_ms: 0,
        dias_com_registro: 0,
        dias_abaixo: 0,
        primeiro_inicio: null,
        ultimo_fim: null,
        tarefas: c.tarefas || 0,
        concluidas: c.concluidas || 0,
        abertas: c.abertas || 0,
        atendimentos: c.atendimentos || 0,
        chamados: c.chamados || 0,
        aulas: c.aulas || 0,
        disciplinas: c.disciplinas || 0,
        outros: c.outros || 0,
        media_ms: c.media_ms || 0,
        visto_em: s.visto_em || null,
        online: s.online || false,
        em_pausa: s.em_pausa || false,
        motivo_pausa: s.motivo_pausa || null,
      });
    }
    const m = juntos.get(l.usuario_id);
    m.meta_ms += Number(l.meta_ms);
    m.jornada_ms += Number(l.jornada_ms);
    m.esforco_ms += Number(l.esforco_ms);
    m.pausa_ms += Number(l.pausa_ms);
    if (l.tarefas > 0) m.dias_com_registro++;
    // Falta só conta em dia de escala, com tolerância de 15 minutos.
    if (l.meta_ms > 0 && Number(l.jornada_ms) < Number(l.meta_ms) - 15 * 60000) m.dias_abaixo++;
    if (l.primeiro_ms && (!m.primeiro_inicio || l.primeiro_ms < m.primeiro_inicio)) {
      m.primeiro_inicio = Number(l.primeiro_ms);
    }
    if (l.ultimo_ms && (!m.ultimo_fim || l.ultimo_ms > m.ultimo_fim)) {
      m.ultimo_fim = Number(l.ultimo_ms);
    }
  }

  const porMediador = [...juntos.values()].sort((a, b) => b.jornada_ms - a.jornada_ms);

  // Evolução no período: uma linha por dia, somando a jornada de cada pessoa.
  const dias = new Map();
  for (const l of grade.rows) {
    if (!dias.has(l.dia)) {
      dias.set(l.dia, { dia: l.dia, jornada_ms: 0, meta_ms: 0, tarefas: 0 });
    }
    const d = dias.get(l.dia);
    d.jornada_ms += Number(l.jornada_ms);
    d.meta_ms += Number(l.meta_ms);
    d.tarefas += Number(l.tarefas);
  }
  const porDia = [...dias.values()]
    .filter((d) => d.meta_ms > 0 || d.tarefas > 0)
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const soma = (campo) => porMediador.reduce((s, m) => s + m[campo], 0);
  const comRegistro = porMediador.filter((m) => m.tarefas > 0);

  const resumo = {
    tarefas: soma("tarefas"),
    concluidas: soma("concluidas"),
    abertas: soma("abertas"),
    jornada_ms: soma("jornada_ms"),
    esforco_ms: soma("esforco_ms"),
    pausa_ms: soma("pausa_ms"),
    meta_ms: soma("meta_ms"),
    // Meta só de quem registrou algo: quem esteve de férias não derruba o índice.
    meta_ativos_ms: comRegistro.reduce((s, m) => s + m.meta_ms, 0),
    mediadores: porMediador.length,
    com_registro: comRegistro.length,
    sem_registro: porMediador.length - comRegistro.length,
    abaixo_da_meta: comRegistro.filter((m) => m.jornada_ms < m.meta_ms - 15 * 60000).length,
    media_ms: Number(extremos.rows[0].media_ms),
    maior_ms: Number(extremos.rows[0].maior_ms),
    online: presenca.rows.filter((s) => s.online && Date.now() - s.visto_em < 5 * 60000).length,
    painelAbertos: totalInscritos(),
  };

  res.json({
    periodo: { de: p[0], ate: p[1], usuarioId: p[2] },
    resumo,
    porTipo: porTipo.rows,
    porMediador,
    porMediadorDia,
    porDia,
    porHora: porHora.rows,
    emAndamento: emAndamento.rows,
    atividades: recentes.rows,
    geradoEm: Date.now(),
  });
}));

// A coordenação encerra o expediente de um mediador que esqueceu demandas
// abertas: fecha o que está rodando na hora do clique e derruba a sessão, para
// a extensão dele pedir a senha de novo no próximo envio.
rotasPainel.post("/encerrar/:usuarioId", assinc(async (req, res) => {
  const id = Number(req.params.usuarioId);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ erro: "Mediador inválido." });
  }

  const { rows: pessoa } = await consulta(
    "select id, nome from usuarios where id = $1 and ativo and papel = 'mediador'",
    [id],
  );
  if (!pessoa.length) {
    return res.status(404).json({ erro: "Mediador não encontrado." });
  }

  // Fecha as demandas abertas, registrando quem encerrou.
  const { rows: fechadas } = await consulta(
    `update atividades
        set fim = now(),
            estado = 'concluida',
            encerrado_por = $2,
            atualizado_em = now()
      where usuario_id = $1 and estado <> 'concluida'
      returning id, titulo, tipo`,
    [id, req.usuario.id],
  );

  // Invalida os tokens já emitidos e marca a pessoa como fora.
  await consulta("update usuarios set desligado_em = now() where id = $1", [id]);
  await consulta(
    `insert into sessoes (usuario_id, visto_em, online, saiu_em, em_pausa, motivo_pausa)
     values ($1, now(), false, now(), false, null)
     on conflict (usuario_id) do update
       set online = false, saiu_em = now(), em_pausa = false, motivo_pausa = null`,
    [id],
  );

  avisar("atividades", { usuario: pessoa[0].nome, quantidade: fechadas.length });
  res.json({ ok: true, nome: pessoa[0].nome, fechadas });
}));

// Tempo real: avisa o painel para recarregar quando chega novidade.
rotasPainel.get("/eventos", (req, res) => {
  const encerrar = inscrever(res);
  req.on("close", encerrar);
});
