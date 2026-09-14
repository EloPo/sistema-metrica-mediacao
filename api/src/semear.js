import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

// Cadastra (ou atualiza) todo mundo que está em equipe.json.
// Rodar de novo é seguro: mantém o id e atualiza nome, papel e senha.
const caminho = process.argv[2] || new URL("../equipe.json", import.meta.url);
const equipe = JSON.parse(await readFile(caminho, "utf8"));

for (const p of equipe) {
  if (!p.usuario || !p.senha) {
    console.warn(`Ignorado (falta usuario ou senha): ${JSON.stringify(p)}`);
    continue;
  }
  const hash = await bcrypt.hash(p.senha, 10);
  await pool.query(
    `insert into usuarios (nome, usuario, email, senha_hash, papel, equipe, carga_semanal)
     values ($1, lower($2), $3, $4, $5, coalesce($6, 'Mediação'), $7)
     on conflict (usuario) do update
       set nome = excluded.nome,
           email = excluded.email,
           senha_hash = excluded.senha_hash,
           papel = excluded.papel,
           equipe = excluded.equipe,
           carga_semanal = excluded.carga_semanal,
           ativo = true`,
    [p.nome, p.usuario, p.email || null, hash, p.papel || "mediador",
     p.equipe || null, Number(p.carga_semanal) || 40],
  );
  const carga = `${Number(p.carga_semanal) || 40}h/semana`;
  console.log(`${p.usuario.padEnd(22)} ${(p.papel || "mediador").padEnd(10)} ${carga.padEnd(12)} ${p.email || "sem e-mail"}`);
}

const { rows } = await pool.query("select count(*)::int as total from usuarios where ativo");
console.log(`\n${rows[0].total} pessoa(s) ativa(s) no cadastro.`);
await pool.end();
