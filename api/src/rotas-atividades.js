import { Router } from "express";
import { consulta } from "./db.js";
import { exigirLogin } from "./auth.js";
import { avisar } from "./eventos.js";
import { assinc } from "./assinc.js";
import { dataLocal } from "./fuso.js";

export const rotasAtividades = Router();
rotasAtividades.use(exigirLogin);

// Se a coordenação encerrou o expediente desta pessoa depois de o token ter
// sido emitido, o token não vale mais. A extensão já trata 401 saindo da conta,
// então ela se desconecta sozinha no próximo envio.
rotasAtividades.use(assinc(async (req, res, proximo) => {
  const { rows } = await consulta(
    "select desligado_em from usuarios where id = $1",
    [req.usuario.id],
  );
  const desligado = rows[0]?.desligado_em;
  // `iat` do token vem em segundos; comparamos no mesmo instante de referência.
  if (desligado && req.usuario.iat && desligado.getTime() > req.usuario.iat * 1000) {
    return res.status(401).json({ erro: "A coordenação encerrou seu expediente. Entre de novo." });
  }
  proximo();
}));

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
         (id, usuario_id, tipo, titulo, observacao, inicio, fim, pausa_ms, pausas,
          estado, origem, editado_em, atualizado_em)
       values ($1,$2,$3,$4,$5, to_timestamp($6/1000.0), $7, $8, $9::jsonb, $10, $11,
               case when $12::bigint is null then null else to_timestamp($12/1000.0) end, now())
       on conflict (id) do update set
         tipo = excluded.tipo,
         titulo = excluded.titulo,
         observacao = excluded.observacao,
         inicio = excluded.inicio,
         fim = excluded.fim,
         pausa_ms = excluded.pausa_ms,
         pausas = excluded.pausas,
         estado = excluded.estado,
         origem = excluded.origem,
         editado_em = excluded.editado_em,
         atualizado_em = now()
       where atividades.usuario_id = excluded.usuario_id
         -- a coordenação tem a palavra final: o que ela editou não é
         -- sobrescrito pelo reenvio automático da extensão
         and atividades.editado_por is null`,
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
        ["extensao", "manual"].includes(a.origem) ? a.origem : "extensao",
        a.editadoEm ? Number(a.editadoEm) : null,
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
        and ($2::date is null or ${dataLocal("inicio")} >= $2::date)
      order by inicio`,
    [req.usuario.id, de],
  );
  res.json({ atividades: rows });
}));
