import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

// Cadastra ou atualiza quem está em equipe.json.
//
// Regra importante: rodar de novo NUNCA troca a senha de quem já existe.
// O arquivo serve para manter nome, e-mail, papel e carga em dia; a senha é
// definida só na criação. Por isso o equipe.json não precisa (e não deve)
// guardar senha nenhuma, ainda mais com o repositório no GitHub.
//
// Para redefinir a senha de alguém de propósito, coloque na pessoa:
//   "redefinir_senha": "a-nova-senha"
// rode uma vez, e apague a linha do arquivo em seguida.
//
// Uso: npm run semear [caminho-do-equipe.json]

const caminho = process.argv[2] || new URL("../equipe.json", import.meta.url);
const equipe = JSON.parse(await readFile(caminho, "utf8"));

// Senha provisória para quem está entrando agora: aleatória e mostrada uma
// única vez, no fim da execução, para você repassar à pessoa.
const provisorias = [];

for (const p of equipe) {
  if (!p.usuario || !p.nome) {
    console.warn(`Ignorado (falta usuario ou nome): ${JSON.stringify(p)}`);
    continue;
  }

  const redefinir = typeof p.redefinir_senha === "string" && p.redefinir_senha.length > 0;
  const senhaNova = redefinir
    ? p.redefinir_senha
    : p.senha || "mediacao-" + crypto.randomInt(1000, 9999);
  const hash = await bcrypt.hash(senhaNova, 10);

  const { rows } = await pool.query(
    `insert into usuarios (nome, usuario, email, senha_hash, papel, equipe, carga_semanal, dias_semana)
     values ($1, lower($2), $3, $4, $5, coalesce($6, 'Mediação'), $7, $8)
     on conflict (usuario) do update
       set nome = excluded.nome,
           email = excluded.email,
           papel = excluded.papel,
           equipe = excluded.equipe,
           carga_semanal = excluded.carga_semanal,
           dias_semana = excluded.dias_semana,
           ativo = true,
           -- a senha só muda quando foi pedido explicitamente
           senha_hash = case when $9 then excluded.senha_hash else usuarios.senha_hash end
     returning (xmax = 0) as criado`,
    [
      p.nome,
      p.usuario,
      p.email || null,
      hash,
      p.papel || "mediador",
      p.equipe || null,
      Number(p.carga_semanal) || 40,
      Number(p.dias_semana) || 5,
      redefinir,
    ],
  );

  const criado = rows[0]?.criado;
  if (criado || redefinir) provisorias.push([p.usuario, senhaNova]);

  const carga = `${Number(p.carga_semanal) || 40}h em ${Number(p.dias_semana) || 5}d`;
  const situacao = criado ? "criado" : redefinir ? "senha redefinida" : "atualizado";
  console.log(`${p.usuario.padEnd(22)} ${(p.papel || "mediador").padEnd(10)} ${carga.padEnd(12)} ${situacao}`);
}

if (provisorias.length) {
  console.log("\nSenhas para repassar (aparecem só agora):");
  for (const [usuario, senha] of provisorias) {
    console.log(`  ${usuario.padEnd(22)} ${senha}`);
  }
  console.log("\nSe você usou redefinir_senha, apague essa linha do equipe.json agora.");
}

const { rows } = await pool.query(
  "select count(*)::int as total from usuarios where ativo",
);
console.log(`\n${rows[0].total} pessoa(s) ativa(s) no cadastro.`);
await pool.end();
