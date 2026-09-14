import { duracao, hora, tipoInfo } from "../formato.js";

export function baixarCsv(atividades, nomeArquivo) {
  const linhas = [[
    "Data", "Mediador", "Tipo", "Identificação", "Início", "Fim",
    "Pausa (min)", "Tempo líquido", "Horas", "Situação", "Observação",
  ]];
  atividades.forEach((a) => {
    linhas.push([
      new Date(a.inicio).toLocaleDateString("pt-BR"),
      a.nome,
      tipoInfo(a.tipo).nome,
      a.titulo,
      hora(a.inicio),
      a.fim ? hora(a.fim) : "",
      Math.round(a.pausa_ms / 60000),
      duracao(a.liquido_ms),
      (a.liquido_ms / 3600000).toFixed(2).replace(".", ","),
      a.estado === "concluida" ? "Concluída" : "Em aberto",
      a.observacao || "",
    ]);
  });
  const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TabelaAtividades({ atividades }) {
  if (!atividades.length) return <p className="vazio">Nenhuma demanda registrada no período.</p>;

  return (
    <div className="rolagem">
      <table>
        <thead>
          <tr>
            <th>Mediador</th>
            <th>Tipo</th>
            <th>Identificação</th>
            <th>Data</th>
            <th>Início</th>
            <th>Fim</th>
            <th className="num">Pausa</th>
            <th className="num">Tempo líquido</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {atividades.map((a) => {
            const t = tipoInfo(a.tipo);
            return (
              <tr key={a.id}>
                <td>{a.nome}</td>
                <td>
                  <span className="selo" style={{ "--cor": t.cor }}>
                    <i />
                    {t.nome}
                  </span>
                </td>
                <td>{a.titulo}</td>
                <td>{new Date(a.inicio).toLocaleDateString("pt-BR")}</td>
                <td>{hora(a.inicio)}</td>
                <td className={a.fim ? "" : "online"}>{a.fim ? hora(a.fim) : "em aberto"}</td>
                <td className="num">{a.pausa_ms ? duracao(a.pausa_ms) : "—"}</td>
                <td className="num">{duracao(a.liquido_ms)}</td>
                <td>{a.observacao}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
