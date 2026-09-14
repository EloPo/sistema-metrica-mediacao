// Gera demandas de exemplo para conferir o painel antes de a equipe começar a usar.
// Uso: npm run exemplo            (últimos 5 dias)
//      npm run exemplo -- 10      (últimos 10 dias)
// Para limpar depois: delete from atividades where origem = 'exemplo';
import { pool } from "./db.js";

const dias = Number(process.argv[2]) || 5;
const tipos = ["atendimento", "chamado", "aula", "disciplina", "outro"];
const pesos = [0.45, 0.25, 0.15, 0.1, 0.05];
const alunos = ["Ana Beatriz", "Carlos Eduardo", "Fernanda Lima", "Gustavo Reis", "Helena Dias",
  "Igor Prado", "Juliana Alves", "Marcos Vieira", "Natália Rocha", "Paulo Henrique"];

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];

function sorteiaTipo() {
  const n = Math.random();
  let acumulado = 0;
  for (let i = 0; i < tipos.length; i++) {
    acumulado += pesos[i];
    if (n <= acumulado) return tipos[i];
  }
  return "outro";
}

function identificacao(tipo) {
  if (tipo === "atendimento") return sorteio(alunos);
  if (tipo === "chamado") return "#" + (4000 + Math.floor(Math.random() * 900));
  if (tipo === "aula") return sorteio(["Cálculo I", "História do Brasil", "Anatomia", "Direito Civil"]);
  if (tipo === "disciplina") return sorteio(["Química Geral", "Redação", "Estatística", "Marketing"]);
  return sorteio(["Reunião de equipe", "Treinamento", "Planilha de acompanhamento"]);
}

const { rows: mediadores } = await pool.query(
  "select id from usuarios where papel = 'mediador' and ativo order by id",
);
if (!mediadores.length) {
  console.error("Cadastre a equipe antes: npm run semear");
  process.exit(1);
}

let total = 0;
for (let d = dias - 1; d >= 0; d--) {
  const dia = new Date();
  dia.setDate(dia.getDate() - d);
  if (dia.getDay() === 0 || dia.getDay() === 6) continue; // sem fim de semana

  for (const m of mediadores) {
    const quantas = 5 + Math.floor(Math.random() * 7);
    for (let i = 0; i < quantas; i++) {
      const tipo = sorteiaTipo();
      const inicio = new Date(dia);
      inicio.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
      const duracaoMin = 8 + Math.floor(Math.random() * 70);
      const pausaMs = Math.random() < 0.25 ? (5 + Math.floor(Math.random() * 45)) * 60000 : 0;
      const fim = new Date(inicio.getTime() + duracaoMin * 60000 + pausaMs);
      const aberta = d === 0 && Math.random() < 0.12;

      await pool.query(
        `insert into atividades (id, usuario_id, tipo, titulo, inicio, fim, pausa_ms, estado, origem)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'exemplo') on conflict (id) do nothing`,
        [
          `ex${m.id}_${d}_${i}`,
          m.id,
          tipo,
          identificacao(tipo),
          inicio,
          aberta ? null : fim,
          pausaMs,
          aberta ? "andamento" : "concluida",
        ],
      );
      total++;
    }
  }
}

await pool.query(
  `insert into sessoes (usuario_id, visto_em)
   select id, now() from usuarios where papel = 'mediador'
   on conflict (usuario_id) do update set visto_em = now()`,
);

console.log(`${total} demandas de exemplo criadas nos últimos ${dias} dias.`);
console.log("Para apagar depois: delete from atividades where origem = 'exemplo';");
await pool.end();
