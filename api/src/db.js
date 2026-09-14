import pg from "pg";
import "dotenv/config";

// Devolve bigint como número (nossos valores são milissegundos, cabem em Number).
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  // Todas as contas de data usam o fuso do time.
  options: `-c timezone=${process.env.TZ || "America/Sao_Paulo"}`,
});

export const consulta = (texto, valores) => pool.query(texto, valores);
