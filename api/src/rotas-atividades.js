import { Router } from "express";
import { consulta } from "./db.js";
import { exigirLogin } from "./auth.js";
import { avisar } from "./eventos.js";
import { assinc } from "./assinc.js";

export const rotasAtividades = Router();
rotasAtividades.use(exigirLogin);

// A extensão manda o estado atual das atividades (uma ou várias).
// Upsert pelo id gerado na máquina do mediador: reenviar é sempre seguro.
rotasAtividades.post("/sincronizar", assinc(async (req, res) => {
  const lista = Array.isArray(req.body.atividades) ? req.body.atividades : [];
  const pausa = req.body.pausaGeral || null;
  const aceitas = [];

  for (const a of lista) {
    if (!a?.id || !a?.tipo || !a?.inicio) continue;
    await consulta(
      `insert into atividades
         (id, usuario_id, tipo, titulo, observacao, inicio, fim, pausa_ms, pausas, estado, atualizado_em)
       values ($1,$2,$3,$4,$5, to_timestamp($6/1000.0), $7, $8, $9::jsonb, $10, now())
       on conflict (id) do update set
         tipo = excluded.tipo,
         titulo = excluded.titulo,
         observacao = excluded.observacao,
         inicio = excluded.inicio,
         fim = excluded.fim,
         pausa_ms = excluded.pausa_ms,
         pausas = excluded.pausas,
         estado = excluded.estado,
         atualizado_em = now()
       where atividades.usuario_id = excluded.usuario_id`,
      [
        a.id,
        req.usuario.id,
        a.tipo,
        String(a.titulo || "").slice(0, 200),
        String(a.observacao || "").slice(0, 500),
        Number(a.inicio),
        a.fim ? new Date(Number(a.fim)) : null,
        Math.max(0, Math.round(Number(a.pausaMs) || 0)),
        JSON.stringify(a.pausas || []),
        a.estado || "andamento",
      ],
    );
    aceitas.push(a.id);
  }

  await consulta(
    `insert into sessoes (usuario_id, visto_em, em_pausa, motivo_pausa, online)
     values ($1, now(), $2, $3, true)
     on conflict (usuario_id) do update
       set visto_em = now(), em_pausa = excluded.em_pausa,
           motivo_pausa = excluded.motivo_pausa, online = true`,
    [req.usuario.id, Boolean(pausa), pausa?.motivo || null],
  );

  avisar("atividades", { usuario: req.usuario.usuario, quantidade: aceitas.length });
  res.json({ ok: true, sincronizadas: aceitas });
}));

// Exclusão feita no relatório da extensão.
rotasAtividades.delete("/:id", assinc(async (req, res) => {
  await consulta("delete from atividades where id = $1 and usuario_id = $2", [
    req.params.id,
    req.usuario.id,
  ]);
  avisar("atividades", { usuario: req.usuario.usuario, quantidade: 0 });
  res.json({ ok: true });
}));

// Usada quando o mediador troca de máquina: devolve o que o servidor tem do dia.
rotasAtividades.get("/minhas", assinc(async (req, res) => {
  const de = req.query.de || null;
  const { rows } = await consulta(
    `select id, tipo, titulo, observacao,
            (extract(epoch from inicio) * 1000)::bigint as inicio,
            case when fim is null then null else (extract(epoch from fim) * 1000)::bigint end as fim,
            pausa_ms, pausas, estado
       from atividades
      where usuario_id = $1
        and ($2::date is null or inicio >= $2::date)
      order by inicio`,
    [req.usuario.id, de],
  );
  res.json({ atividades: rows });
}));
