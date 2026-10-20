import { duracao, percentual } from "../formato.js";

function Kpi({ valor, rotulo, nota, cor, alerta }) {
  return (
    <div className="kpi" style={{ "--cor": cor }}>
      <div className={"kpi-valor" + (alerta ? " alerta" : "")}>{valor}</div>
      <div className="kpi-rotulo">{rotulo}</div>
      {nota && <div className="kpi-nota">{nota}</div>}
    </div>
  );
}

export default function Kpis({ dados, totalMediadores }) {
  const r = dados.resumo;

  // O índice compara a jornada com a meta de quem teve registro no período.
  // Quem esteve de férias ou afastado não derruba o número da equipe.
  const cumprimento = percentual(r.jornada_ms, r.meta_ativos_ms);
  const paralelo = Math.max(0, r.esforco_ms - r.jornada_ms);

  return (
    <div className="kpis">
      <Kpi
        valor={duracao(r.jornada_ms)}
        rotulo="Jornada trabalhada"
        nota="Tempo real, sem contar demandas em paralelo duas vezes"
        cor="#1b2434"
      />
      <Kpi
        valor={`${cumprimento}%`}
        rotulo="Cumprimento da carga horária"
        nota={`Meta de quem trabalhou: ${duracao(r.meta_ativos_ms)}`}
        cor={cumprimento >= 100 ? "#0E7C66" : "#b03a2e"}
        alerta={cumprimento < 100}
      />
      <Kpi
        valor={r.abaixo_da_meta}
        rotulo="Mediadores abaixo da meta"
        nota={
          r.sem_registro
            ? `De ${r.com_registro} com registro · ${r.sem_registro} sem nenhum`
            : `De ${r.com_registro} com registro no período`
        }
        cor="#b03a2e"
        alerta={r.abaixo_da_meta > 0}
      />
      <Kpi
        valor={duracao(r.esforco_ms)}
        rotulo="Tempo dedicado às demandas"
        nota={`${duracao(paralelo)} foram em atendimento simultâneo`}
        cor="#2F5FD0"
      />
      <Kpi
        valor={r.tarefas}
        rotulo="Demandas no período"
        nota={`${r.concluidas} concluídas · ${r.abertas} em aberto`}
        cor="#8A3E86"
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
        cor="#5B6B7F"
      />
      <Kpi
        valor={duracao(r.pausa_ms)}
        rotulo="Tempo em pausa"
        nota="Almoço, café e intervalos, fora da jornada"
        cor="#a86a1f"
      />
      <Kpi
        valor={duracao(r.maior_ms)}
        rotulo="Demanda mais longa"
        nota={`${totalMediadores} mediador(es) cadastrados`}
        cor="#C2451E"
      />
    </div>
  );
}
