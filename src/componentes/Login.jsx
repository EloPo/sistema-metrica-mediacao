import { useState } from "react";
import { entrar, salvarSessao } from "../api.js";

export default function Login({ aoEntrar }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const dados = await entrar(usuario.trim().toLowerCase(), senha);
      if (dados.usuario.papel !== "gestor") {
        setErro("Este acesso é da coordenação. Mediadores usam a extensão.");
        return;
      }
      salvarSessao(dados);
      aoEntrar(dados);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-caixa" onSubmit={enviar}>
        <h1>Painel da mediação</h1>
        <p className="sub">Acompanhe as demandas da equipe em tempo real.</p>

        {erro && <p className="erro">{erro}</p>}

        <label className="campo">
          Usuário
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="nome.sobrenome"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="campo">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button className="btn forte largo" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
