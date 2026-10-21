import { useEffect, useRef, useState } from "react";
import { criarDemanda, excluirDemanda, salvarDemanda } from "../api.js";
import { TIPOS, deCampoLocal, paraCampoLocal } from "../formato.js";

// Lançar ou corrigir a demanda de um mediador.
// Mexer no registro de outra pessoa muda as horas dela, então o formulário
// avisa disso e tudo o que sai daqui fica marcado no painel.
export default function EditorDemanda({ demanda, mediadores, aoFechar, aoConcluir }) {
  const editando = Boolean(demanda?.id);
  const dialogo = useRef(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const agora = Date.now();
  const [form, setForm] = useState(() => ({
    usuarioId: demanda?.usuario_id || mediadores[0]?.id || "",
    tipo: demanda?.tipo || "atendimento",
    titulo: demanda?.titulo || "",
    inicio: paraCampoLocal(demanda?.inicio || agora - 3600000),
    fim: demanda?.fim ? paraCampoLocal(demanda.fim) : "",
    pausaMin: demanda ? Math.round((demanda.pausa_ms || 0) / 60000) : 0,
    observacao: demanda?.observacao || "",
  }));

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function salvar() {
    setErro("");
    const inicio = deCampoLocal(form.inicio);
    if (!inicio) return setErro("Informe a data e a hora de início.");
    const fim = form.fim ? deCampoLocal(form.fim) : null;
    if (form.fim && !fim) return setErro("A data de fim não é válida.");

    const dados = {
      usuarioId: Number(form.usuarioId),
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      inicio,
      fim,
      pausaMs: Math.max(0, Number(form.pausaMin) || 0) * 60000,
      observacao: form.observacao.trim(),
    };

    setEnviando(true);
    try {
      const r = editando
        ? await salvarDemanda(demanda.id, dados)
        : await criarDemanda(dados);
      aoConcluir(
        editando
          ? `Demanda de ${r.nome} corrigida.`
          : `Demanda lançada para ${r.nome}.`,
      );
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  async function excluir() {
    setErro("");
    setEnviando(true);
    try {
      const r = await excluirDemanda(demanda.id);
      aoConcluir(`Demanda "${r.titulo}" apagada do registro de ${r.nome}.`);
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
      setConfirmandoExclusao(false);
    }
  }

  const nomeDoMediador =
    demanda?.nome || mediadores.find((m) => m.id === Number(form.usuarioId))?.nome;

  return (
    <dialog className="dialogo" ref={dialogo} onCancel={aoFechar}>
      <h2>{editando ? "Corrigir demanda" : "Lançar demanda"}</h2>
      <p className="dialogo-texto">
        {editando
          ? `Isto altera as horas registradas de ${nomeDoMediador}. A correção fica marcada no painel como feita pela coordenação.`
          : "A demanda entra no registro do mediador escolhido, marcada como lançada pela coordenação."}
      </p>

      {erro && <p className="erro">{erro}</p>}

      <div className="form-grade">
        {!editando && (
          <label className="campo-form">
            Mediador
            <select value={form.usuarioId} onChange={mudar("usuarioId")}>
              {mediadores.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </label>
        )}

        <label className="campo-form">
          Tipo
          <select value={form.tipo} onChange={mudar("tipo")}>
            {Object.entries(TIPOS).map(([chave, t]) => (
              <option key={chave} value={chave}>{t.nome}</option>
            ))}
          </select>
        </label>

        <label className="campo-form larga">
          Identificação
          <input
            value={form.titulo}
            onChange={mudar("titulo")}
            placeholder={TIPOS[form.tipo]?.campo || "Nome do aluno"}
          />
        </label>

        <label className="campo-form">
          Início
          <input type="datetime-local" value={form.inicio} onChange={mudar("inicio")} />
        </label>

        <label className="campo-form">
          Fim
          <input type="datetime-local" value={form.fim} onChange={mudar("fim")} />
        </label>

        <label className="campo-form">
          Pausa (minutos)
          <input type="number" min="0" step="1" value={form.pausaMin} onChange={mudar("pausaMin")} />
        </label>

        <label className="campo-form larga">
          Observação
          <input value={form.observacao} onChange={mudar("observacao")} />
        </label>
      </div>

      <p className="dialogo-dica">
        Deixe o fim em branco para a demanda continuar contando como aberta.
      </p>

      {confirmandoExclusao ? (
        <menu className="dialogo-botoes">
          <span className="dialogo-texto confirma">Apagar esta demanda de vez?</span>
          <button type="button" className="btn" onClick={() => setConfirmandoExclusao(false)} disabled={enviando}>
            Não
          </button>
          <button type="button" className="btn perigo" onClick={excluir} disabled={enviando}>
            {enviando ? "Apagando…" : "Sim, apagar"}
          </button>
        </menu>
      ) : (
        <menu className="dialogo-botoes">
          {editando && (
            <button
              type="button"
              className="btn apagar"
              onClick={() => setConfirmandoExclusao(true)}
              disabled={enviando}
            >
              Apagar
            </button>
          )}
          <button type="button" className="btn" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="btn forte" onClick={salvar} disabled={enviando}>
            {enviando ? "Salvando…" : editando ? "Salvar correção" : "Lançar demanda"}
          </button>
        </menu>
      )}
    </dialog>
  );
}
