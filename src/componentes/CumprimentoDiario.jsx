import { comSinal, diaBonito, duracao, percentual, situacaoMeta } from "../formato.js";

export function baixarCumprimentoCsv(linhas, nomeArquivo) {
  const cabecalho = [
    "Data", "Mediador", "Carga semanal", "Meta do dia", "Jornada trabalhada",
    "Horas de jornada", "Diferença", "Situação", "Demandas",
    "Tempo dedicado às demandas", "Em paralelo", "Pausas",
  ];
  const corpo = linhas.map((l) => {
    const s = situacaoMeta(l.jornada_ms, l.meta_ms);
    const paralelo = Math.max(0, l.esforco_ms - l.jornada_ms);
    return [
      new Date(l.dia + "T12:00").toLocaleDateString("pt-BR"),
      l.nome,
      `${l.carga_semanal}h`,
      l.meta_ms ? duracao(l.meta_ms) : "—",
      duracao(l.jornada_ms),
      (l.jornada_ms / 3600000).toFixed(2).replace(".", ","),
      l.meta_ms ? comSinal(s.diferenca) : "—",
      l.tarefas === 0 && l.meta_ms > 0 ? "Sem registro" : s.rotulo,
      l.tarefas,
      duracao(l.esforco_ms),
      duracao(paralelo),
      duracao(l.pausa_ms),
    ];
  });
  const csv = [cabecalho, ...corpo]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CumprimentoDiario({ linhas }) {
  if (!linhas.length) return <p className="vazio">Nenhum dia de escala no período.</p>;

  return (
    <div className="rolagem">
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Mediador</th>
            <th className="num">Carga</th>
            <th className="num">Meta do dia</th>
            <th className="num">Jornada</th>
            <th>Cumprimento</th>
            <th className="num">Diferença</th>
            <th className="num">Demandas</th>
            <th className="num">Dedicado</th>
            <th className="num">Em paralelo</th>
            <th className="num">Pausas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const s = situacaoMeta(l.jornada_ms, l.meta_ms);
            const pct = percentual(l.jornada_ms, l.meta_ms);
            const paralelo = Math.max(0, l.esforco_ms - l.jornada_ms);
            const semRegistro = l.tarefas === 0 && l.meta_ms > 0;
            return (
              <tr key={l.dia + l.usuario_id}>
                <td>{diaBonito(l.dia)}</td>
                <td>{l.nome}</td>
                <td className="num">{l.carga_semanal}h/sem</td>
                <td className="num">{l.meta_ms ? duracao(l.meta_ms) : "—"}</td>
                <td className="num">
                  {semRegistro ? <span className="alerta">sem registro</span> : <b>{duracao(l.jornada_ms)}</b>}
                </td>
                <td>
                  {l.meta_ms > 0 && (
                    <div className="meta-barra" title={`${pct}% da meta`}>
                      <span className={s.estado} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  )}
                </td>
                <td className={"num " + (s.estado === "abaixo" ? "alerta" : "")}>
                  {l.meta_ms ? comSinal(s.diferenca) : "—"}
                  {s.estado === "abaixo" && " ⚠"}
                </td>
                <td className="num">{l.tarefas}</td>
                <td className="num">{duracao(l.esforco_ms)}</td>
                <td className="num">{paralelo ? duracao(paralelo) : "—"}</td>
                <td className="num">{l.pausa_ms ? duracao(l.pausa_ms) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
