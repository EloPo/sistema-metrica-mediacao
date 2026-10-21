import { Router } from "express";
import crypto from "node:crypto";
import { consulta } from "./db.js";
import { exigirLogin, exigirGestor } from "./auth.js";
import { assinc } from "./assinc.js";
import { avisar } from "./eventos.js";

// A coordenação lança, corrige e apaga demandas de qualquer mediador.
// Tudo o que entra por aqui fica marcado: quem criou, quem editou e quando.
export const rotasCrud = Router();
rotasCrud.use(exigirLogin, exigirGestor);

const TIPOS = ["atendimento", "chamado", "aula", "disciplina", "outro"];

// Valida e normaliza o que veio do painel. Devolve { dados } ou { erro }.
function conferir(corpo, { exigeMediador }) {
  const tipo = String(corpo.tipo || "").trim();
  if (!TIPOS.includes(tipo)) {
    return { erro: "Escolha um tipo de atividade." };
  }

  const titulo = String(corpo.titulo || "").trim();
  if (!titulo) return { erro: "Informe a identificação da demanda." };
  if (titulo.length > 200) return { erro: "A identificação é longa demais." };

  const inicio = Number(corpo.inicio);
  if (!Number.isFinite(inicio) || inicio <= 0) {
    return { erro: "Informe a data e a hora de início." };
  }

  const fim = corpo.fim === null || corpo.fim === undefined || corpo.fim === ""
    ? null
    : Number(corpo.fim);
  if (fim !== null && (!Number.isFinite(fim) || fim < inicio)) {
    return { erro: "O fim não pode ser anterior ao início." };
  }

  const limite = Date.now() + 5 * 60000; // alguma folga para relógios desencontrados
  if (inicio > limite || (fim !== null && fim > limite)) {
    return { erro: "Não dá para registrar demanda no futuro." };
  }

  const pausaMs = Math.max(0, Math.round(Number(corpo.pausaMs) || 0));
  if (fim !== null && pausaMs > fim - inicio) {
    return { erro: "A pausa não cabe dentro da duração da demanda." };
  }

  let usuarioId = null;
  if (exigeMediador) {
    usuarioId = Number(corpo.usuarioId);
    if (!Number.isFinite(usuarioId)) return { erro: "Escolha o mediador." };
  }

  return {
    dados: {
      usuarioId,
      tipo,
      titulo,
      observacao: String(corpo.observacao || "").trim().slice(0, 500),
      inicio,
      fim,
      pausaMs,
      estado: fim === null ? "andamento" : "concluida",
    },
  };
}

// Lançar uma demanda no lugar de um mediador.
rotasCrud.post("/", assinc(async (req, res) => {
  const { dados, erro } = conferir(req.body, { exigeMediador: true });
  if (erro) return res.status(400).json({ erro });

  const { rows: pessoa } = await consulta(
    "select id, nome from usuarios where id = $1 and ativo and papel = 'mediador'",
    [dados.usuarioId],
  );
  if (!pessoa.length) return res.status(404).json({ erro: "Mediador não encontrado." });

  const id = "co" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { rows } = await consulta(
    `insert into atividades
       (id, usuario_id, tipo, titulo, observacao, inicio, fim, pausa_ms, pausas,
        estado, origem, criado_por, editado_por, editado_em, atualizado_em)
     values ($1,$2,$3,$4,$5, to_timestamp($6/1000.0),
             case when $7::bigint is null then null else to_timestamp($7/1000.0) end,
             $8, '[]'::jsonb, $9, 'coordenacao', $10, $10, now(), now())
     returning id`,
    [id, dados.usuarioId, dados.tipo, dados.titulo, dados.observacao,
     dados.inicio, dados.fim, dados.pausaMs, dados.estado, req.usuario.id],
  );

  avisar("atividades", { usuario: pessoa[0].nome, quantidade: 1 });
  res.json({ ok: true, id: rows[0].id, nome: pessoa[0].nome });
}));

// Corrigir uma demanda existente, seja de quem for.
rotasCrud.put("/:id", assinc(async (req, res) => {
  const { dados, erro } = conferir(req.body, { exigeMediador: false });
  if (erro) return res.status(400).json({ erro });

  const { rows } = await consulta(
    `update atividades
        set tipo = $2, titulo = $3, observacao = $4,
            inicio = to_timestamp($5/1000.0),
            fim = case when $6::bigint is null then null else to_timestamp($6/1000.0) end,
            pausa_ms = $7,
            estado = $8,
            editado_por = $9,
            editado_em = now(),
            atualizado_em = now()
      where id = $1
      returning id, usuario_id,
                (select nome from usuarios u where u.id = atividades.usuario_id) as nome`,
    [req.params.id, dados.tipo, dados.titulo, dados.observacao,
     dados.inicio, dados.fim, dados.pausaMs, dados.estado, req.usuario.id],
  );
  if (!rows.length) return res.status(404).json({ erro: "Demanda não encontrada." });

  avisar("atividades", { usuario: rows[0].nome, quantidade: 1 });
  res.json({ ok: true, id: rows[0].id, nome: rows[0].nome });
}));

// Apagar uma demanda. Vai embora de vez, então o painel confirma antes.
rotasCrud.delete("/:id", assinc(async (req, res) => {
  const { rows } = await consulta(
    `delete from atividades where id = $1
     returning id, titulo,
               (select nome from usuarios u where u.id = atividades.usuario_id) as nome`,
    [req.params.id],
  );
  if (!rows.length) return res.status(404).json({ erro: "Demanda não encontrada." });

  avisar("atividades", { usuario: rows[0].nome, quantidade: 0 });
  res.json({ ok: true, titulo: rows[0].titulo, nome: rows[0].nome });
}));
