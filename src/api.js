const BASE = (import.meta.env.VITE_API || "http://localhost:3333").replace(/\/$/, "");
const CHAVE = "mediacao.sessao";

export function lerSessao() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || null;
  } catch {
    return null;
  }
}

export function salvarSessao(sessao) {
  localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function limparSessao() {
  localStorage.removeItem(CHAVE);
}

async function pedir(caminho, opcoes = {}) {
  const sessao = lerSessao();
  const resposta = await fetch(BASE + caminho, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      ...opcoes.headers,
    },
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401) limparSessao();
    throw new Error(corpo.erro || `Falha na chamada (${resposta.status}).`);
  }
  return corpo;
}

export function entrar(usuario, senha) {
  return pedir("/api/login", { method: "POST", body: JSON.stringify({ usuario, senha }) });
}

export function buscarPainel({ de, ate, usuario }) {
  const q = new URLSearchParams({ de, ate });
  if (usuario) q.set("usuario", usuario);
  return pedir(`/api/painel?${q}`);
}

// A coordenação encerra o expediente de um mediador: fecha as demandas abertas
// e derruba a sessão dele.
export function encerrarExpediente(usuarioId) {
  return pedir(`/api/painel/encerrar/${usuarioId}`, { method: "POST" });
}

// CRUD de demandas pela coordenação.
export function criarDemanda(dados) {
  return pedir("/api/painel/atividades", { method: "POST", body: JSON.stringify(dados) });
}

export function salvarDemanda(id, dados) {
  return pedir(`/api/painel/atividades/${id}`, { method: "PUT", body: JSON.stringify(dados) });
}

export function excluirDemanda(id) {
  return pedir(`/api/painel/atividades/${id}`, { method: "DELETE" });
}

export function buscarMediadores() {
  return pedir("/api/painel/mediadores");
}

// Fluxo de tempo real. Devolve a função para encerrar a conexão.
export function ouvirEventos(aoReceber) {
  const sessao = lerSessao();
  if (!sessao) return () => {};
  const fonte = new EventSource(`${BASE}/api/painel/eventos?token=${encodeURIComponent(sessao.token)}`);
  fonte.addEventListener("atividades", aoReceber);
  fonte.onerror = () => {}; // o EventSource reconecta sozinho
  return () => fonte.close();
}
