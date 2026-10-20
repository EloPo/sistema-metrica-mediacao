// Fuso de referência do sistema. Tudo que vira "dia" passa por aqui.
//
// Por que isto existe: um timestamptz guarda o instante absoluto, mas
// `inicio::date` converte usando o fuso da sessão do banco. Através do pooler
// do Supabase a sessão é UTC, então o dia virava às 21h de Brasília e as
// demandas da noite caíam no dia seguinte. A correção é não depender da
// sessão: o fuso vai explícito em cada consulta.

const PADRAO = "America/Sao_Paulo";

// Só nomes de fuso bem formados, porque este valor entra no texto do SQL.
const nome = process.env.TZ || PADRAO;
export const FUSO = /^[A-Za-z]+(?:[/_-][A-Za-z0-9+-]+)*$/.test(nome) ? nome : PADRAO;

// Trecho de SQL que converte uma coluna timestamptz na data local.
export const dataLocal = (coluna) => `((${coluna} at time zone '${FUSO}')::date)`;

// Trecho de SQL que extrai a hora local de uma coluna timestamptz.
export const horaLocal = (coluna) => `(extract(hour from (${coluna} at time zone '${FUSO}'))::int)`;

// Data de hoje no fuso do sistema, independente do fuso do servidor.
export const hojeLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
