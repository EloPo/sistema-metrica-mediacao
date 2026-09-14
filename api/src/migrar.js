import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const sql = await readFile(fileURLToPath(new URL("./schema.sql", import.meta.url)), "utf8");
await pool.query(sql);
console.log("Estrutura do banco criada ou já atualizada.");
await pool.end();
