// Gera uma semana de dados realistas para o demonstrativo do painel.
// Diferente do exemplo.js, aqui cada mediador tem um comportamento próprio,
// para que a coordenação veja os casos que importam: quem cumpre, quem está
// abaixo da meta, quem atende muita coisa em paralelo e quem não registrou nada.
//
// Uso: node src/demo.js
// Limpar:  delete from atividades where origem = 'demo';
import { pool } from "./db.js";

const ALUNOS = [
  "Ana Beatriz Rocha", "Carlos Eduardo Lima", "Fernanda Dias", "Gustavo Reis",
  "Helena Siqueira", "Igor Prado", "Juliana Alves", "Marcos Vieira",
  "Natália Campos", "Paulo Henrique Sá", "Rafaela Moreira", "Thiago Borges",
  "Vanessa Lopes", "Wesley Antunes", "Bianca Correia",
];
const TURMAS = [
  "Cálculo I — turma B", "História do Brasil — turma A", "Anatomia Humana",
  "Direito Civil II", "Algoritmos — turma C", "Psicologia Social",
];
const DISCIPLINAS = [
  "Química Geral", "Redação Acadêmica", "Estatística Aplicada",
  "Marketing Digital", "Contabilidade I", "Metodologia Científica",
];
const OUTRAS = [
  "Reunião de equipe", "Treinamento da plataforma", "Planilha de acompanhamento",
];

const sorteio = (l) => l[Math.floor(Math.random() * l.length)];
const inteiro = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Cada perfil descreve como a pessoa trabalha: em que horário chega, quantas
// demandas toca ao mesmo tempo e quanto costuma cumprir da jornada.
const PERFIS = {
  "ana.souza": { entrada: 8, jornada: [8.0, 8.6], simultaneas: [3, 4], almoco: true },
  "bruno.martins": { entrada: 9, jornada: [7.8, 8.3], simultaneas: [2, 3], almoco: true },
  "carla.nogueira": { entrada: 13, jornada: [4.0, 4.5], simultaneas: [2, 3], almoco: false },
  "diego.ferreira": { entrada: 8, jornada: [3.1, 4.3], simultaneas: [1, 2], almoco: false },
  "elaine.prado": { entrada: 9, jornada: [5.5, 6.8], simultaneas: [1, 2], almoco: true },
  // Renata foi cadastrada agora e ainda não começou: aparece como "Nunca entrou".
  "renata.beck": null,
};

// Pesos por tipo de demanda: atendimento domina, configuração é rara.
function sorteiaTipo() {
  const n = Math.random();
  if (n < 0.46) return "atendimento";
  if (n < 0.70) return "chamado";
  if (n < 0.85) return "aula";
  if (n < 0.96) return "disciplina";
  return "outro";
}

function identificacao(tipo) {
  if (tipo === "atendimento") return sorteio(ALUNOS);
  if (tipo === "chamado") return "#" + inteiro(4100, 4890);
  if (tipo === "aula") return sorteio(TURMAS);
  if (tipo === "disciplina") return sorteio(DISCIPLINAS);
  return sorteio(OUTRAS);
}

const OBSERVACOES = [
  "", "", "", "", "Aluno retornou depois", "Encaminhado à secretaria",
  "Pendente de resposta do professor", "Resolvido na primeira tentativa",
];

const { rows: pessoas } = await pool.query(
  `select id, usuario, nome, carga_semanal from usuarios
    where papel = 'mediador' and ativo order by id`,
);

await pool.query("delete from atividades where origem = 'demo'");

const agora = new Date();
let total = 0;
const abertasHoje = [];

for (let recuo = 29; recuo >= 0; recuo--) {
  const dia = new Date(agora);
  dia.setDate(dia.getDate() - recuo);
  const semana = dia.getDay();
  if (semana === 0 || semana === 6) continue; // sem fim de semana

  for (const pessoa of pessoas) {
    const perfil = PERFIS[pessoa.usuario];
    if (!perfil) continue; // quem ainda não começou a trabalhar

    // Elaine falta uma vez por semana: vira "sem registro" no painel.
    if (pessoa.usuario === "elaine.prado" && recuo % 7 === 3) continue;
    // Diego tirou três dias de folga no meio do mês.
    if (pessoa.usuario === "diego.ferreira" && recuo >= 16 && recuo <= 18) continue;

    const horasDoDia = perfil.jornada[0] + Math.random() * (perfil.jornada[1] - perfil.jornada[0]);
    const inicioDia = new Date(dia);
    inicioDia.setHours(perfil.entrada, inteiro(0, 25), 0, 0);

    const fimDia = new Date(inicioDia.getTime() + horasDoDia * 3600000 + (perfil.almoco ? 3600000 : 0));
    const hoje = recuo === 0;
    // Hoje só começam demandas até agora, mas elas podem seguir até o fim do
    // expediente — é assim que aparecem as que ainda estão em andamento.
    const limite = fimDia.getTime();
    const limiteInicio = hoje ? Math.min(limite, agora.getTime()) : limite;

    const almoco = perfil.almoco
      ? { inicio: new Date(dia).setHours(12, 0, 0, 0), fim: new Date(dia).setHours(13, 0, 0, 0) }
      : null;

    // As demandas são distribuídas em blocos que se sobrepõem, que é como a
    // mediação trabalha de fato: várias conversas abertas ao mesmo tempo.
    let cursor = inicioDia.getTime();
    let indice = 0;

    while (cursor < limiteInicio - 15 * 60000) {
      const simultaneas = inteiro(perfil.simultaneas[0], perfil.simultaneas[1]);
      const blocoMin = inteiro(55, 120);

      for (let s = 0; s < simultaneas && cursor < limiteInicio - 10 * 60000; s++) {
        const atraso = s === 0 ? 0 : inteiro(0, 14) * 60000;
        const comeca = cursor + atraso;
        const duracaoMs = Math.max(10 * 60000, (blocoMin - inteiro(0, 25)) * 60000);
        // Nada passa do fim do expediente: a jornada tem que bater com o perfil.
        let termina = Math.min(comeca + duracaoMs, limite);
        if (termina - comeca < 6 * 60000) break;

        // Demanda que atravessa o almoço carrega a pausa junto.
        const pausas = [];
        let pausaMs = 0;
        if (almoco && comeca < almoco.inicio && termina > almoco.inicio) {
          termina = Math.min(termina + 3600000, limite + 3600000);
          pausas.push({ inicio: almoco.inicio, fim: almoco.fim, motivo: "Almoço", geral: true });
          pausaMs = 3600000;
        }

        // Uma pausa curta de café, de vez em quando.
        if (!pausaMs && Math.random() < 0.07) {
          const cafe = inteiro(8, 16) * 60000;
          const inicioCafe = comeca + Math.floor((termina - comeca) / 2);
          pausas.push({ inicio: inicioCafe, fim: inicioCafe + cafe, motivo: "Café", geral: true });
          termina = Math.min(termina + cafe, limite + cafe);
          pausaMs = cafe;
        }

        const emAberto = hoje && termina > agora.getTime();
        const tipo = sorteiaTipo();

        await pool.query(
          `insert into atividades
             (id, usuario_id, tipo, titulo, observacao, inicio, fim, pausa_ms, pausas, estado, origem)
           values ($1,$2,$3,$4,$5,to_timestamp($6/1000.0),$7,$8,$9::jsonb,$10,'demo')`,
          [
            `demo_${pessoa.id}_${recuo}_${indice}`,
            pessoa.id,
            tipo,
            identificacao(tipo),
            sorteio(OBSERVACOES),
            comeca,
            emAberto ? null : new Date(termina),
            pausaMs,
            JSON.stringify(pausas),
            emAberto ? "andamento" : "concluida",
          ],
        );
        if (emAberto) abertasHoje.push(pessoa.usuario);
        indice++;
        total++;
      }
      cursor += blocoMin * 60000;
      if (almoco && cursor > almoco.inicio && cursor < almoco.fim) cursor = almoco.fim;
    }
  }
}

// Estado de presença: dois trabalhando, uma em pausa, dois offline e uma que
// nunca entrou — para a coluna "Situação" mostrar os quatro casos.
const presenca = {
  "ana.souza": { online: true, minutos: 1, pausa: null },
  "bruno.martins": { online: true, minutos: 2, pausa: null },
  "carla.nogueira": { online: true, minutos: 1, pausa: "Café" },
  "diego.ferreira": { online: false, minutos: 95, pausa: null },
  "elaine.prado": { online: false, minutos: 180, pausa: null },
  "renata.beck": null, // cadastrada, mas nunca fez login
};

await pool.query("delete from sessoes");
for (const pessoa of pessoas) {
  const p = presenca[pessoa.usuario];
  if (!p) continue;
  await pool.query(
    `insert into sessoes (usuario_id, visto_em, online, em_pausa, motivo_pausa)
     values ($1, now() - ($2 || ' minutes')::interval, $3, $4, $5)`,
    [pessoa.id, p.minutos, p.online, Boolean(p.pausa), p.pausa],
  );
}

console.log(`${total} demandas criadas · ${abertasHoje.length} ainda em andamento`);
await pool.end();
