import { useEffect, useRef, useState } from "react";
import { encerrarExpediente } from "../api.js";
import { duracao, hora } from "../formato.js";

// Confirmação para encerrar o expediente de alguém pela coordenação.
// É uma ação que mexe nas horas de outra pessoa, então a tela diz exatamente
// o que vai acontecer antes de acontecer.
export default function EncerrarExpediente({ mediador, abertas, aoFechar, aoConcluir }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const dialogo = useRef(null);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  async function confirmar() {
    setErro("");
    setEnviando(true);
    try {
      const r = await encerrarExpediente(mediador.id);
      aoConcluir(
        r.fechadas.length
          ? `Expediente de ${r.nome} encerrado. ${r.fechadas.length} demanda(s) fechada(s).`
          : `${r.nome} foi desconectado. Não havia demanda aberta.`,
      );
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  const agora = new Date();

  return (
    <dialog className="dialogo" ref={dialogo} onCancel={aoFechar}>
      <h2>Encerrar o expediente de {mediador.nome}?</h2>

      {abertas.length > 0 ? (
        <>
          <p className="dialogo-texto">
            {abertas.length === 1 ? "Esta demanda será fechada" : "Estas demandas serão fechadas"} às{" "}
            <b>{hora(agora)}</b>, e esse horário contará como o fim do trabalho:
          </p>
          <ul className="dialogo-lista">
            {abertas.map((a) => (
              <li key={a.id}>
                <span>{a.titulo}</span>
                <span className="dialogo-tempo">
                  desde {hora(a.inicio)} · {duracao(Date.now() - a.inicio)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="dialogo-texto">
          Não há demanda aberta. {mediador.nome} será apenas desconectado.
        </p>
      )}

      <p className="dialogo-texto">
        A extensão vai pedir a senha novamente no próximo envio, em até um minuto. O registro
        guarda que foi a coordenação quem encerrou.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <menu className="dialogo-botoes">
        <button type="button" className="btn" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </button>
        <button type="button" className="btn perigo" onClick={confirmar} disabled={enviando}>
          {enviando ? "Encerrando…" : "Encerrar expediente"}
        </button>
      </menu>
    </dialog>
  );
}
