import { duracao, hora, procedencia, tipoInfo } from "../formato.js";

export function baixarCsv(atividades, nomeArquivo) {
  const linhas = [[
    "Data", "Mediador", "Tipo", "Identificação", "Início", "Fim",
    "Pausa (min)", "Tempo na demanda", "Horas", "Situação", "Observação",
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
      (() => {
        const m = procedencia(a);
        const base = a.estado === "concluida" ? "Concluída" : "Em aberto";
        return m ? `${base} — ${m.rotulo}${m.detalhe ? " (" + m.detalhe + ")" : ""}` : base;
      })(),
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

export default function TabelaAtividades({ atividades, aoEditar }) {
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
            <th className="num">Tempo na demanda</th>
            <th>Observação</th>
            {aoEditar && <th></th>}
          </tr>
        </thead>
        <tbody>
          {atividades.map((a) => {
            const t = tipoInfo(a.tipo);
            const marca = procedencia(a);
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
                <td className={a.fim ? "" : "online"}>
                  {a.fim ? hora(a.fim) : "em aberto"}
                  {marca && (
                    <span
                      className="selo-encerrado"
                      title={marca.detalhe ? `${marca.rotulo} — ${marca.detalhe}` : marca.rotulo}
                    >
                      {marca.rotulo}
                    </span>
                  )}
                </td>
                <td className="num">{a.pausa_ms ? duracao(a.pausa_ms) : "—"}</td>
                <td className="num">{duracao(a.liquido_ms)}</td>
                <td>{a.observacao}</td>
                {aoEditar && (
                  <td>
                    <button type="button" className="acao-linha" onClick={() => aoEditar(a)}>
                      Corrigir
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
