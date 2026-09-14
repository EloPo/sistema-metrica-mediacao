import { Router } from "express";
import { consulta } from "./db.js";
import { exigirLogin, exigirGestor } from "./auth.js";
import { inscrever, totalInscritos } from "./eventos.js";
import { assinc } from "./assinc.js";

export const rotasPainel = Router();
rotasPainel.use(exigirLogin, exigirGestor);

const FILTRO = `inicio >= $1::date and inicio < ($2::date + interval '1 day')
                and ($3::int is null or usuario_id = $3::int)`;

function parametros(req) {
  const hoje = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD no fuso local
  const de = req.query.de || hoje;
  const ate = req.query.ate || de;
  const usuarioId = req.query.usuario ? Number(req.query.usuario) : null;
  return [de, ate, Number.isFinite(usuarioId) ? usuarioId : null];
}

// Lista de gente para o seletor do painel.
rotasPainel.get("/mediadores", assinc(async (_req, res) => {
  const { rows } = await consulta(
    `select id, nome, usuario, equipe from usuarios
      where ativo and papel = 'mediador' order by nome`,
  );
  res.json({ mediadores: rows });
}));

// Tudo o que o painel desenha, em uma chamada só.
rotasPainel.get("/", assinc(async (req, res) => {
  const p = parametros(req);

  const [resumo, porTipo, porMediador, porDia, porHora, emAndamento, recentes, presenca, porMediadorDia] =
    await Promise.all([
      consulta(
        `select
           count(*)::int as tarefas,
           count(*) filter (where estado = 'concluida')::int as concluidas,
           count(*) filter (where estado <> 'concluida')::int as abertas,
           count(distinct usuario_id)::int as mediadores,
           coalesce(sum(liquido_ms), 0) as liquido_ms,
           coalesce(sum(pausa_ms), 0) as pausa_ms,
           coalesce(avg(liquido_ms) filter (where estado = 'concluida'), 0)::bigint as media_ms,
           coalesce(max(liquido_ms), 0) as maior_ms
         from v_atividades where ${FILTRO}`,
        p,
      ),
      consulta(
        `select tipo,
                count(*)::int as tarefas,
                coalesce(sum(liquido_ms), 0) as liquido_ms,
                coalesce(avg(liquido_ms), 0)::bigint as media_ms
           from v_atividades where ${FILTRO}
          group by tipo order by liquido_ms desc`,
        p,
      ),
      consulta(
        `select u.id, u.nome, u.usuario,
                count(a.id)::int as tarefas,
                count(a.id) filter (where a.estado = 'concluida')::int as concluidas,
                count(a.id) filter (where a.estado <> 'concluida')::int as abertas,
                count(a.id) filter (where a.tipo = 'atendimento')::int as atendimentos,
                count(a.id) filter (where a.tipo = 'chamado')::int as chamados,
                count(a.id) filter (where a.tipo = 'aula')::int as aulas,
                count(a.id) filter (where a.tipo = 'disciplina')::int as disciplinas,
                count(a.id) filter (where a.tipo = 'outro')::int as outros,
                coalesce(sum(a.liquido_ms), 0) as liquido_ms,
                coalesce(sum(a.pausa_ms), 0) as pausa_ms,
                coalesce(avg(a.liquido_ms) filter (where a.estado = 'concluida'), 0)::bigint as media_ms,
                (extract(epoch from min(a.inicio)) * 1000)::bigint as primeiro_inicio,
                (extract(epoch from max(coalesce(a.fim, now()))) * 1000)::bigint as ultimo_fim,
                (extract(epoch from s.visto_em) * 1000)::bigint as visto_em,
                coalesce(s.em_pausa, false) as em_pausa,
                s.motivo_pausa,
                coalesce(s.online, false) as online,
                u.carga_semanal,
                u.email
           from usuarios u
           left join v_atividades a
             on a.usuario_id = u.id
            and a.inicio >= $1::date and a.inicio < ($2::date + interval '1 day')
           left join sessoes s on s.usuario_id = u.id
          where u.ativo and u.papel = 'mediador'
            and ($3::int is null or u.id = $3::int)
          group by u.id, u.nome, u.usuario, u.carga_semanal, u.email,
                   s.visto_em, s.em_pausa, s.motivo_pausa, s.online
          order by liquido_ms desc, u.nome`,
        p,
      ),
      consulta(
        `select to_char(inicio, 'YYYY-MM-DD') as dia,
                count(*)::int as tarefas,
                coalesce(sum(liquido_ms), 0) as liquido_ms
           from v_atividades where ${FILTRO}
          group by 1 order by 1`,
        p,
      ),
      consulta(
        `select extract(hour from inicio)::int as hora,
                count(*)::int as tarefas,
                coalesce(sum(liquido_ms), 0) as liquido_ms
           from v_atividades where ${FILTRO}
          group by 1 order by 1`,
        p,
      ),
      consulta(
        `select id, nome, usuario, tipo, titulo, estado,
                (extract(epoch from inicio) * 1000)::bigint as inicio,
                pausa_ms, liquido_ms
           from v_atividades
          where estado <> 'concluida'
            and ($1::int is null or usuario_id = $1::int)
          order by inicio`,
        [p[2]],
      ),
      consulta(
        `select id, nome, usuario, tipo, titulo, observacao, estado,
                (extract(epoch from inicio) * 1000)::bigint as inicio,
                case when fim is null then null else (extract(epoch from fim) * 1000)::bigint end as fim,
                pausa_ms, liquido_ms
           from v_atividades where ${FILTRO}
          order by inicio desc limit 400`,
        p,
      ),
      consulta(
        `select count(*)::int as online
           from sessoes s join usuarios u on u.id = s.usuario_id
          where u.papel = 'mediador' and s.online
            and s.visto_em > now() - interval '5 minutes'`,
      ),
      consulta(
        `select a.usuario_id, a.nome, u.carga_semanal,
                to_char(a.inicio, 'YYYY-MM-DD') as dia,
                count(*)::int as tarefas,
                coalesce(sum(a.liquido_ms), 0) as liquido_ms,
                coalesce(sum(a.pausa_ms), 0) as pausa_ms
           from v_atividades a
           join usuarios u on u.id = a.usuario_id
          where a.inicio >= $1::date and a.inicio < ($2::date + interval '1 day')
            and ($3::int is null or a.usuario_id = $3::int)
          group by a.usuario_id, a.nome, u.carga_semanal, dia
          order by dia desc, a.nome`,
        p,
      ),
    ]);

  res.json({
    periodo: { de: p[0], ate: p[1], usuarioId: p[2] },
    resumo: { ...resumo.rows[0], online: presenca.rows[0].online, painelAbertos: totalInscritos() },
    porTipo: porTipo.rows,
    porMediador: porMediador.rows,
    porDia: porDia.rows,
    porHora: porHora.rows,
    emAndamento: emAndamento.rows,
    atividades: recentes.rows,
    porMediadorDia: porMediadorDia.rows,
    geradoEm: Date.now(),
  });
}));

// Tempo real: avisa o painel para recarregar quando chega novidade.
rotasPainel.get("/eventos", (req, res) => {
  const encerrar = inscrever(res);
  req.on("close", encerrar);
});
