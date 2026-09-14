import { diaBonito, duracao, metaDiariaMs, percentual, situacaoMeta } from "../formato.js";

export function baixarCumprimentoCsv(linhas, nomeArquivo) {
  const cabecalho = [
    "Data", "Mediador", "Carga semanal", "Meta do dia", "Tempo produzido",
    "Horas produzidas", "Diferença", "Situação", "Demandas", "Pausas",
  ];
  const corpo = linhas.map((l) => {
    const meta = metaDiariaMs(l.carga_semanal);
    const s = situacaoMeta(l.liquido_ms, meta);
    return [
      new Date(l.dia + "T12:00").toLocaleDateString("pt-BR"),
      l.nome,
      `${l.carga_semanal}h`,
      duracao(meta),
      duracao(l.liquido_ms),
      (l.liquido_ms / 3600000).toFixed(2).replace(".", ","),
      (s.diferenca < 0 ? "-" : "+") + duracao(Math.abs(s.diferenca)),
      s.rotulo,
      l.tarefas,
      duracao(l.pausa_ms),
    ];
  });
  const csv = [cabecalho, ...corpo]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CumprimentoDiario({ linhas }) {
  if (!linhas.length) return <p className="vazio">Sem produção registrada no período.</p>;

  return (
    <div className="rolagem">
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Mediador</th>
            <th className="num">Carga</th>
            <th className="num">Meta do dia</th>
            <th className="num">Produzido</th>
            <th>Cumprimento</th>
            <th className="num">Diferença</th>
            <th className="num">Demandas</th>
            <th className="num">Pausas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const meta = metaDiariaMs(l.carga_semanal);
            const s = situacaoMeta(l.liquido_ms, meta);
            const pct = percentual(l.liquido_ms, meta);
            return (
              <tr key={l.dia + l.usuario_id}>
                <td>{diaBonito(l.dia)}</td>
                <td>{l.nome}</td>
                <td className="num">{l.carga_semanal}h/sem</td>
                <td className="num">{duracao(meta)}</td>
                <td className="num">
                  <b>{duracao(l.liquido_ms)}</b>
                </td>
                <td>
                  <div className="meta-barra" title={`${pct}% da meta`}>
                    <span className={s.estado} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </td>
                <td className={"num " + (s.estado === "abaixo" ? "alerta" : "")}>
                  {s.diferenca < 0 ? "−" : "+"}
                  {duracao(Math.abs(s.diferenca))}
                  {s.estado === "abaixo" && " ⚠"}
                </td>
                <td className="num">{l.tarefas}</td>
                <td className="num">{l.pausa_ms ? duracao(l.pausa_ms) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
