import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { consulta } from "./db.js";
import { assinc } from "./assinc.js";

const SEGREDO = process.env.JWT_SEGREDO || "segredo-de-desenvolvimento";
const VALIDADE = "12h";

export const rotasAuth = Router();

rotasAuth.post("/login", assinc(async (req, res) => {
  const usuario = String(req.body.usuario || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  if (!usuario || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha." });
  }

  const { rows } = await consulta(
    "select * from usuarios where usuario = $1 and ativo",
    [usuario],
  );
  const pessoa = rows[0];
  if (!pessoa || !(await bcrypt.compare(senha, pessoa.senha_hash))) {
    return res.status(401).json({ erro: "Usuário ou senha não conferem." });
  }

  const token = jwt.sign(
    { id: pessoa.id, usuario: pessoa.usuario, papel: pessoa.papel, nome: pessoa.nome },
    SEGREDO,
    { expiresIn: VALIDADE },
  );

  // Entrar de novo cancela um desligamento feito pela coordenação. Fazer isso
  // explicitamente evita depender da precisão de segundos do `iat` do token.
  await consulta("update usuarios set desligado_em = null where id = $1", [pessoa.id]);
  await consulta(
    `insert into sessoes (usuario_id, visto_em, online) values ($1, now(), true)
     on conflict (usuario_id) do update set visto_em = now(), online = true, saiu_em = null`,
    [pessoa.id],
  );

  res.json({
    token,
    usuario: { id: pessoa.id, nome: pessoa.nome, usuario: pessoa.usuario, papel: pessoa.papel },
  });
}));

rotasAuth.get("/eu", exigirLogin, (req, res) => res.json({ usuario: req.usuario }));

// Saída explícita: o painel passa a mostrar a pessoa como offline na hora.
rotasAuth.post("/sair", exigirLogin, assinc(async (req, res) => {
  await consulta(
    `insert into sessoes (usuario_id, visto_em, online, saiu_em)
     values ($1, now(), false, now())
     on conflict (usuario_id) do update set online = false, saiu_em = now()`,
    [req.usuario.id],
  );
  res.json({ ok: true });
}));

export function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || "";
  const token = cabecalho.startsWith("Bearer ")
    ? cabecalho.slice(7)
    : req.query.token; // EventSource não envia cabeçalho

  if (!token) return res.status(401).json({ erro: "Faça login para continuar." });
  try {
    req.usuario = jwt.verify(token, SEGREDO);
    next();
  } catch {
    res.status(401).json({ erro: "Sessão expirada. Faça login de novo." });
  }
}

export function exigirGestor(req, res, next) {
  if (req.usuario?.papel !== "gestor") {
    return res.status(403).json({ erro: "Apenas a coordenação acessa o painel." });
  }
  next();
}
