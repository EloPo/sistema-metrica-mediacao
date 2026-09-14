import { Router } from "express";
import nodemailer from "nodemailer";
import { consulta } from "./db.js";
import { exigirLogin } from "./auth.js";
import { assinc } from "./assinc.js";

export const rotasRelatorio = Router();
rotasRelatorio.use(exigirLogin);

const TIPOS = {
  atendimento: "Atendimento ao aluno",
  chamado: "Sistema de chamados",
  aula: "Mediação de aula ao vivo",
  disciplina: "Configuração de disciplina",
  outro: "Outra atividade",
};

const duracao = (ms) => {
  const min = Math.round((ms || 0) / 60000);
  const h = Math.floor(min / 60);
  return h === 0 ? `${min}min` : `${h}h ${String(min % 60).padStart(2, "0")}min`;
};
const hora = (d) =>
  d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

function transporte() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORTA || 587),
    secure: String(process.env.SMTP_SEGURO || "false") === "true",
    auth: process.env.SMTP_USUARIO
      ? { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA }
      : undefined,
  });
}

// Fecha o dia: monta o relatório do mediador e manda para o e-mail dele.
rotasRelatorio.post("/enviar", assinc(async (req, res) => {
  const dia = req.body.dia || new Date().toLocaleDateString("en-CA");

  const { rows: pessoa } = await consulta(
    "select nome, email, carga_semanal from usuarios where id = $1",
    [req.usuario.id],
  );
  const { nome, email, carga_semanal } = pessoa[0] || {};

  const { rows: atividades } = await consulta(
    `select tipo, titulo, observacao, inicio, fim, pausa_ms, liquido_ms, estado
       from v_atividades
      where usuario_id = $1 and inicio >= $2::date and inicio < ($2::date + interval '1 day')
      order by inicio`,
    [req.usuario.id, dia],
  );

  if (!atividades.length) {
    return res.status(400).json({ erro: "Nenhuma demanda registrada neste dia." });
  }

  const total = atividades.reduce((s, a) => s + Number(a.liquido_ms), 0);
  const pausas = atividades.reduce((s, a) => s + Number(a.pausa_ms), 0);
  const metaMs = ((carga_semanal || 40) / 5) * 3600000;
  const diferenca = total - metaMs;

  const linhas = atividades
    .map(
      (a) => `<tr>
        <td>${TIPOS[a.tipo] || a.tipo}</td>
        <td>${a.titulo}</td>
        <td>${hora(a.inicio)}</td>
        <td>${a.fim ? hora(a.fim) : "em aberto"}</td>
        <td align="right">${a.pausa_ms ? duracao(a.pausa_ms) : "—"}</td>
        <td align="right"><b>${duracao(a.liquido_ms)}</b></td>
        <td>${a.observacao || ""}</td>
      </tr>`,
    )
    .join("");

  const dataBonita = new Date(dia + "T12:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const html = `
  <div style="font-family:Segoe UI,system-ui,sans-serif;color:#1b2434;font-size:14px">
    <h2 style="margin:0 0 2px">Relatório de ${nome}</h2>
    <p style="margin:0 0 18px;color:#5f6b7d">${dataBonita}</p>
    <p style="margin:0 0 18px">
      <b>${duracao(total)}</b> produzidos em ${atividades.length} demanda(s).
      Meta do dia: ${duracao(metaMs)}.
      <span style="color:${diferenca >= 0 ? "#0e7c66" : "#b03a2e"}">
        ${diferenca >= 0 ? "Meta atingida" : "Faltaram " + duracao(Math.abs(diferenca))}
      </span>.
      Tempo em pausa, fora da conta: ${duracao(pausas)}.
    </p>
    <table cellpadding="7" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="background:#f4f6f8;text-align:left">
          <th>Tipo</th><th>Identificação</th><th>Início</th><th>Fim</th>
          <th align="right">Pausa</th><th align="right">Tempo líquido</th><th>Observação</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`;

  const csv = [
    ["Data", "Tipo", "Identificação", "Início", "Fim", "Pausa (min)", "Tempo líquido", "Horas", "Observação"],
    ...atividades.map((a) => [
      new Date(a.inicio).toLocaleDateString("pt-BR"),
      TIPOS[a.tipo] || a.tipo,
      a.titulo,
      hora(a.inicio),
      a.fim ? hora(a.fim) : "",
      Math.round(a.pausa_ms / 60000),
      duracao(a.liquido_ms),
      (a.liquido_ms / 3600000).toFixed(2).replace(".", ","),
      a.observacao || "",
    ]),
  ]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  const resumo = {
    dia,
    demandas: atividades.length,
    liquidoMs: total,
    pausaMs: pausas,
    metaMs,
    diferencaMs: diferenca,
  };

  const correio = transporte();
  if (!correio || !email) {
    return res.status(200).json({
      ok: false,
      motivo: !email ? "sem-email" : "sem-smtp",
      resumo,
    });
  }

  await correio.sendMail({
    from: process.env.SMTP_DE || process.env.SMTP_USUARIO,
    to: email,
    cc: process.env.RELATORIO_COPIA || undefined,
    subject: `Relatório de mediação — ${new Date(dia + "T12:00").toLocaleDateString("pt-BR")}`,
    html,
    attachments: [{ filename: `mediacao-${dia}.csv`, content: "\uFEFF" + csv }],
  });

  res.json({ ok: true, enviadoPara: email, resumo });
}));
