import "dotenv/config";
import express from "express";
import cors from "cors";
import { rotasAuth } from "./auth.js";
import { rotasAtividades } from "./rotas-atividades.js";
import { rotasPainel } from "./rotas-painel.js";
import { rotasRelatorio } from "./rotas-relatorio.js";
import { pool } from "./db.js";

const app = express();
const origens = (process.env.ORIGENS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origem, callback) {
      // Sem origem = extensão do Chrome, curl, app nativo.
      if (!origem || origem.startsWith("chrome-extension://") || origens.includes(origem)) {
        return callback(null, true);
      }
      callback(new Error("Origem não liberada: " + origem));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/saude", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true, hora: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.use("/api", rotasAuth);
app.use("/api/atividades", rotasAtividades);
app.use("/api/painel", rotasPainel);
app.use("/api/relatorio", rotasRelatorio);

app.use((erro, _req, res, _next) => {
  console.error(erro);
  res.status(500).json({ erro: "Erro interno. Veja o log do servidor." });
});

const porta = process.env.PORTA || 3333;
app.listen(porta, () => console.log(`API de mediação ouvindo em http://localhost:${porta}`));
