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

// Meta diária = carga semanal dividida pelos cinco dias úteis.
export const metaDiariaMs = (cargaSemanal) => ((cargaSemanal || 40) / 5) * 3600000;

// Quantos dias úteis existem entre duas datas (inclusive).
export function diasUteis(de, ate) {
  const inicio = new Date(de + "T12:00");
  const fim = new Date(ate + "T12:00");
  let total = 0;
  for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const semana = d.getDay();
    if (semana !== 0 && semana !== 6) total++;
  }
  return Math.max(1, total);
}

// Como está em relação à meta: acima, perto (até 15min a menos) ou abaixo.
export function situacaoMeta(feitoMs, metaMs) {
  const diferenca = feitoMs - metaMs;
  if (diferenca >= 0) return { estado: "cumprida", diferenca, rotulo: "Meta atingida" };
  if (Math.abs(diferenca) <= 15 * 60000) return { estado: "perto", diferenca, rotulo: "Quase lá" };
  return { estado: "abaixo", diferenca, rotulo: "Abaixo da meta" };
}

export const percentual = (feito, meta) => (meta > 0 ? Math.round((feito / meta) * 100) : 0);

// Situação de conexão de cada mediador, para a coluna do painel.
export function situacaoConexao(m) {
  if (!m.visto_em) return { classe: "offline", texto: "Nunca entrou" };
  if (!m.online) return { classe: "offline", texto: "Offline" };
  if (!estaOnline(m.visto_em)) return { classe: "offline", texto: "Offline" };
  if (m.em_pausa) return { classe: "pausado", texto: m.motivo_pausa || "Em pausa" };
  return { classe: "online", texto: "Trabalhando" };
}
