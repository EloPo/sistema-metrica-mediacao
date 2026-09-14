import {
  dataHora, diasUteis, duracao, hora, metaDiariaMs, percentual, situacaoConexao, situacaoMeta,
} from "../formato.js";

export default function TabelaMediadores({ porMediador, aoEscolher, de, ate }) {
  const dias = diasUteis(de, ate);

  return (
    <div className="rolagem">
      <table>
        <thead>
          <tr>
            <th>Mediador</th>
            <th>Situação</th>
            <th className="num">Carga</th>
            <th className="num">Meta do período</th>
            <th className="num">Produzido</th>
            <th>Cumprimento</th>
            <th className="num">Diferença</th>
            <th className="num">Demandas</th>
            <th className="num">Concluídas</th>
            <th className="num">Abertas</th>
            <th className="num">Atendimentos</th>
            <th className="num">Chamados</th>
            <th className="num">Aulas</th>
            <th className="num">Disciplinas</th>
            <th className="num">Outras</th>
            <th className="num">Média por demanda</th>
            <th className="num">Pausas</th>
            <th>Primeiro registro</th>
            <th>Último sinal</th>
          </tr>
        </thead>
        <tbody>
          {porMediador.map((m) => {
            const conexao = situacaoConexao(m);
            const meta = metaDiariaMs(m.carga_semanal) * dias;
            const s = situacaoMeta(m.liquido_ms, meta);
            const pct = percentual(m.liquido_ms, meta);
            return (
              <tr key={m.id} className="clicavel" onClick={() => aoEscolher(String(m.id))}>
                <td>{m.nome}</td>
                <td><span className={conexao.classe}>{conexao.texto}</span></td>
                <td className="num">{m.carga_semanal}h/sem</td>
                <td className="num">{duracao(meta)}</td>
                <td className="num"><b>{duracao(m.liquido_ms)}</b></td>
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
                <td className="num">{m.tarefas}</td>
                <td className="num">{m.concluidas}</td>
                <td className="num">{m.abertas}</td>
                <td className="num">{m.atendimentos}</td>
                <td className="num">{m.chamados}</td>
                <td className="num">{m.aulas}</td>
                <td className="num">{m.disciplinas}</td>
                <td className="num">{m.outros}</td>
                <td className="num">{m.concluidas ? duracao(m.media_ms) : "—"}</td>
                <td className="num">{m.pausa_ms ? duracao(m.pausa_ms) : "—"}</td>
                <td>{m.primeiro_inicio ? hora(m.primeiro_inicio) : "—"}</td>
                <td>{dataHora(m.visto_em)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
