export const TIPOS = {
  atendimento: { nome: "Atendimento ao aluno", curto: "Atendimentos", cor: "#2F5FD0" },
  chamado: { nome: "Sistema de chamados", curto: "Chamados", cor: "#8A3E86" },
  aula: { nome: "Mediação de aula ao vivo", curto: "Aulas ao vivo", cor: "#C2451E" },
  disciplina: { nome: "Configuração de disciplina", curto: "Disciplinas", cor: "#0E7C66" },
  outro: { nome: "Outra atividade", curto: "Outras", cor: "#5B6B7F" },
};

export const tipoInfo = (t) => TIPOS[t] || TIPOS.outro;

export function duracao(ms) {
  const min = Math.round((ms || 0) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, "0")}min`;
}

export function horas(ms) {
  return Number(((ms || 0) / 3600000).toFixed(2));
}

export function cronometro(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function hora(ts) {
  return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function dataHora(ts) {
  return ts ? new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function diaISO(data = new Date()) {
  return data.toLocaleDateString("en-CA");
}

export function diaBonito(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function somarDias(dias) {
  return diaISO(new Date(Date.now() + dias * 86400000));
}

// Uma pessoa está "online" se a extensão dela falou com a API nos últimos 5 minutos.
export const estaOnline = (visto) => Boolean(visto) && Date.now() - visto < 5 * 60000;

// --- Carga horária ---------------------------------------------------------
// A meta de cada dia é calculada no servidor (carga semanal ÷ dias de escala,
// aplicada só nos dias de escala da pessoa). Aqui só interpretamos o resultado.

export function situacaoMeta(jornadaMs, metaMs) {
  const diferenca = jornadaMs - metaMs;
  if (metaMs === 0) return { estado: "fora", diferenca, rotulo: "Fora da escala" };
  if (diferenca >= 0) return { estado: "cumprida", diferenca, rotulo: "Meta atingida" };
  if (Math.abs(diferenca) <= 15 * 60000) return { estado: "perto", diferenca, rotulo: "Quase lá" };
  return { estado: "abaixo", diferenca, rotulo: "Abaixo da meta" };
}

export const percentual = (feito, meta) => (meta > 0 ? Math.round((feito / meta) * 100) : 0);

// Sinal com + ou − na frente, para colunas de diferença.
export const comSinal = (ms) => (ms < 0 ? "−" : "+") + duracao(Math.abs(ms));

// Situação de conexão de cada mediador, para a coluna do painel.
export function situacaoConexao(m) {
  if (!m.visto_em) return { classe: "offline", texto: "Nunca entrou" };
  if (!m.online) return { classe: "offline", texto: "Offline" };
  if (!estaOnline(m.visto_em)) return { classe: "offline", texto: "Offline" };
  if (m.em_pausa) return { classe: "pausado", texto: m.motivo_pausa || "Em pausa" };
  return { classe: "online", texto: "Trabalhando" };
}

// --- Datas para campos de formulário ---------------------------------------

// Converte um instante para o formato que o <input type="datetime-local"> usa.
export function paraCampoLocal(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function deCampoLocal(valor) {
  if (!valor) return null;
  const ms = new Date(valor).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Como a demanda entrou no sistema, para o painel mostrar a procedência.
export function procedencia(a) {
  if (a.origem === "coordenacao") {
    return { rotulo: "lançada pela coordenação", detalhe: a.criado_por_nome };
  }
  if (a.encerrado_por_nome) {
    return { rotulo: "encerrada pela coordenação", detalhe: a.encerrado_por_nome };
  }
  if (a.editado_por_nome) {
    return { rotulo: "corrigida pela coordenação", detalhe: a.editado_por_nome };
  }
  if (a.origem === "manual") {
    return { rotulo: "lançada à mão pelo mediador", detalhe: null };
  }
  if (a.editado_em) {
    return { rotulo: "editada pelo mediador", detalhe: null };
  }
  return null;
}
