import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buscarMediadores, buscarPainel, lerSessao, limparSessao, ouvirEventos,
} from "./api.js";
import { diaISO, somarDias } from "./formato.js";
import Login from "./componentes/Login.jsx";
import Kpis from "./componentes/Kpis.jsx";
import Agora from "./componentes/Agora.jsx";
import TabelaMediadores from "./componentes/TabelaMediadores.jsx";
import TabelaAtividades, { baixarCsv } from "./componentes/TabelaAtividades.jsx";
import EncerrarExpediente from "./componentes/EncerrarExpediente.jsx";
import EditorDemanda from "./componentes/EditorDemanda.jsx";
import Calendario from "./componentes/Calendario.jsx";
import CumprimentoDiario, { baixarCumprimentoCsv } from "./componentes/CumprimentoDiario.jsx";
import { DivisaoPorTipo, SerieDoPeriodo, TempoPorMediador } from "./componentes/Graficos.jsx";

// Um seletor só para o período, com a opção de escolher datas à mão.

export default function App() {
  const [sessao, setSessao] = useState(lerSessao());
  const [filtros, setFiltros] = useState({ de: diaISO(), ate: diaISO(), usuario: "" });
  const [mediadores, setMediadores] = useState([]);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [aviso, setAviso] = useState("");
  const [encerrando, setEncerrando] = useState(null);
  const [editando, setEditando] = useState(null);
  const carregando = useRef(false);

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5200);
  }

  // No demonstrativo o navegador bloqueia o download, então o botão explica
  // em vez de não fazer nada. No sistema instalado ele baixa o arquivo.
  function baixar(gerar) {
    if (import.meta.env.VITE_DEMO) {
      mostrarAviso("O CSV baixa no sistema instalado. Aqui no demonstrativo o download fica desligado.");
      return;
    }
    gerar();
  }


  const carregar = useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    try {
      const resposta = await buscarPainel(filtros);
      setDados(resposta);
      setAtualizadoEm(Date.now());
      setErro("");
    } catch (e) {
      setErro(e.message);
      if (/sessão|login/i.test(e.message)) setSessao(null);
    } finally {
      carregando.current = false;
    }
  }, [filtros]);

  useEffect(() => {
    if (!sessao) return;
    carregar();
    buscarMediadores().then((r) => setMediadores(r.mediadores)).catch(() => {});
  }, [sessao, carregar]);

  // Tempo real: a API avisa, o painel recarrega. O intervalo é a rede de segurança.
  useEffect(() => {
    if (!sessao) return;
    let agendado = null;
    const fechar = ouvirEventos(() => {
      clearTimeout(agendado);
      agendado = setTimeout(carregar, 800);
    });
    const relogio = setInterval(carregar, 30000);
    return () => {
      clearTimeout(agendado);
      clearInterval(relogio);
      fechar();
    };
  }, [sessao, carregar]);

  const mediadorEscolhido = useMemo(
    () => mediadores.find((m) => String(m.id) === filtros.usuario),
    [mediadores, filtros.usuario],
  );

  if (!sessao) return <Login aoEntrar={setSessao} />;

  const umDiaSo = filtros.de === filtros.ate;
  const sufixo = umDiaSo ? filtros.de : `${filtros.de}_a_${filtros.ate}`;

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <div>
            <h1>{mediadorEscolhido ? mediadorEscolhido.nome : "Visão geral da mediação"}</h1>
            <p className="sub">
              {umDiaSo
                ? new Date(filtros.de + "T12:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "numeric", month: "long",
                  })
                : `${new Date(filtros.de + "T12:00").toLocaleDateString("pt-BR")} até ${new Date(filtros.ate + "T12:00").toLocaleDateString("pt-BR")}`}
              {atualizadoEm && ` · atualizado ${new Date(atualizadoEm).toLocaleTimeString("pt-BR")}`}
            </p>
          </div>

          <div className="controles">
            <span className="pulso"><i />ao vivo</span>

            <Calendario
              de={filtros.de}
              ate={filtros.ate}
              aoEscolher={(de, ate) => setFiltros((f) => ({ ...f, de, ate }))}
            />

            <select
              value={filtros.usuario}
              onChange={(e) => setFiltros((f) => ({ ...f, usuario: e.target.value }))}
            >
              <option value="">Todos os mediadores</option>
              {mediadores.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>

            <button
              className="btn"
              onClick={() => {
                limparSessao();
                setSessao(null);
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {aviso && <p className="aviso-flutuante" role="status">{aviso}</p>}

      {editando && (
        <EditorDemanda
          demanda={editando === "nova" ? null : editando}
          mediadores={mediadores}
          aoFechar={() => setEditando(null)}
          aoConcluir={(texto) => {
            setEditando(null);
            mostrarAviso(texto);
            carregar();
          }}
        />
      )}

      {encerrando && (
        <EncerrarExpediente
          mediador={encerrando}
          abertas={(dados?.emAndamento || []).filter((a) => a.nome === encerrando.nome)}
          aoFechar={() => setEncerrando(null)}
          aoConcluir={(texto) => {
            setEncerrando(null);
            mostrarAviso(texto);
            carregar();
          }}
        />
      )}

      <main>
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <p className="vazio">Carregando os números…</p>}

        {dados && (
          <>
            <section>
              <Kpis dados={dados} totalMediadores={mediadores.length} />
            </section>

            <section>
              <h2>Acontecendo agora</h2>
              <Agora itens={dados.emAndamento} geradoEm={dados.geradoEm} />
            </section>

            <section className="colunas">
              <div className="cartao">
                <h2>Jornada x meta por mediador</h2>
                <TempoPorMediador
                  porMediador={dados.porMediador}
                  aoClicar={(id) => setFiltros((f) => ({ ...f, usuario: String(id) }))}
                />
              </div>
              <div className="cartao">
                <h2>Divisão por tipo de demanda</h2>
                <DivisaoPorTipo porTipo={dados.porTipo} />
              </div>
              <div className="cartao">
                <h2>{umDiaSo ? "Demandas iniciadas por hora" : "Jornada da equipe por dia"}</h2>
                <SerieDoPeriodo porDia={dados.porDia} porHora={dados.porHora} umDiaSo={umDiaSo} />
              </div>
            </section>

            <section>
              <p className="nota-calculo">
                <b>Jornada</b> é o tempo real de trabalho: períodos unidos, sem contar duas vezes
                o que foi atendido em paralelo e já sem as pausas. É esse número que a carga
                horária compara. <b>Dedicado</b> é a soma do tempo de cada demanda, que pode
                passar das horas do dia justamente por causa do atendimento simultâneo.
              </p>
              <div className="secao-topo">
                <h2>Carga horária dia a dia</h2>
                <button
                  className="btn"
                  onClick={() => baixar(() => baixarCumprimentoCsv(dados.porMediadorDia, `carga-horaria-${sufixo}.csv`))}
                >
                  Baixar carga horária em CSV
                </button>
              </div>
              <CumprimentoDiario linhas={dados.porMediadorDia} />
            </section>

            <section>
              <h2>Números por mediador</h2>
              <TabelaMediadores
                porMediador={dados.porMediador}
                aoEscolher={(id) => setFiltros((f) => ({ ...f, usuario: id }))}
                aoEncerrar={setEncerrando}
              />
            </section>

            <section>
              <div className="secao-topo">
                <h2>Demanda por demanda</h2>
                <div className="secao-acoes">
                  <button className="btn" onClick={() => setEditando("nova")}>
                    Lançar demanda
                  </button>
                  <button
                    className="btn"
                    onClick={() => baixar(() => baixarCsv(dados.atividades, `mediacao-${sufixo}.csv`))}
                  >
                    Baixar demandas em CSV
                  </button>
                </div>
              </div>
              <TabelaAtividades atividades={dados.atividades} aoEditar={setEditando} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
