import { diasUteis, duracao, metaDiariaMs, percentual } from "../formato.js";

function Kpi({ valor, rotulo, nota, cor, alerta }) {
  return (
    <div className="kpi" style={{ "--cor": cor }}>
      <div className={"kpi-valor" + (alerta ? " alerta" : "")}>{valor}</div>
      <div className="kpi-rotulo">{rotulo}</div>
      {nota && <div className="kpi-nota">{nota}</div>}
    </div>
  );
}

export default function Kpis({ dados, totalMediadores, de, ate }) {
  const r = dados.resumo;
  const dias = diasUteis(de, ate);
  const comRegistro = dados.porMediador.filter((m) => m.tarefas > 0).length;
  const mediaPorPessoa = comRegistro ? Math.round(r.tarefas / comRegistro) : 0;

  // Meta da equipe: soma da meta diária de cada pessoa pelos dias úteis do período.
  const metaEquipe = dados.porMediador.reduce((s, m) => s + metaDiariaMs(m.carga_semanal) * dias, 0);
  const cumprimento = percentual(r.liquido_ms, metaEquipe);
  const abaixoDaMeta = dados.porMediador.filter(
    (m) => m.liquido_ms < metaDiariaMs(m.carga_semanal) * dias - 15 * 60000,
  ).length;

  return (
    <div className="kpis">
      <Kpi
        valor={duracao(r.liquido_ms)}
        rotulo="Horas produzidas"
        nota="Pausas já descontadas"
        cor="#1b2434"
      />
      <Kpi
        valor={`${cumprimento}%`}
        rotulo="Cumprimento da carga horária"
        nota={`Meta do período: ${duracao(metaEquipe)}`}
        cor={cumprimento >= 100 ? "#0E7C66" : "#b03a2e"}
        alerta={cumprimento < 100}
      />
      <Kpi
        valor={abaixoDaMeta}
        rotulo="Mediadores abaixo da meta"
        nota={`De ${dados.porMediador.length} no período`}
        cor="#b03a2e"
        alerta={abaixoDaMeta > 0}
      />
      <Kpi
        valor={r.tarefas}
        rotulo="Demandas no período"
        nota={`${r.concluidas} concluídas · ${r.abertas} em aberto`}
        cor="#2F5FD0"
      />
      <Kpi
        valor={dados.emAndamento.length}
        rotulo="Rodando neste momento"
        nota={`${r.online} mediador(es) com a extensão ativa`}
        cor="#0E7C66"
      />
      <Kpi
        valor={duracao(r.media_ms)}
        rotulo="Tempo médio por demanda"
        nota="Considera só o que já foi concluído"
        cor="#8A3E86"
      />
      <Kpi
        valor={duracao(r.pausa_ms)}
        rotulo="Tempo em pausa"
        nota="Almoço, café e intervalos, fora da conta"
        cor="#a86a1f"
      />
      <Kpi
        valor={duracao(r.maior_ms)}
        rotulo="Demanda mais longa"
        nota="Maior tempo líquido registrado"
        cor="#C2451E"
      />
      <Kpi
        valor={mediaPorPessoa}
        rotulo="Demandas por mediador"
        nota={`${comRegistro} de ${totalMediadores} com registro no período`}
        cor="#5B6B7F"
      />
    </div>
  );
}
