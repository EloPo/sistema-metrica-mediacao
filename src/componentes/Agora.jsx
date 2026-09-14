import { useEffect, useState } from "react";
import { cronometro, hora, tipoInfo } from "../formato.js";

export default function Agora({ itens, geradoEm }) {
  const [, tique] = useState(0);

  // Os cronômetros andam na tela entre uma atualização e outra do servidor.
  useEffect(() => {
    const id = setInterval(() => tique((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!itens.length) {
    return <p className="vazio">Ninguém com demanda aberta agora.</p>;
  }

  const decorrido = Date.now() - geradoEm;

  return (
    <div className="agora">
      {itens.map((a) => {
        const t = tipoInfo(a.tipo);
        const correndo = a.estado === "andamento";
        const tempo = a.liquido_ms + (correndo ? decorrido : 0);
        return (
          <div
            key={a.id}
            className={"agora-item" + (correndo ? "" : " pausada")}
            style={{ "--cor": t.cor }}
          >
            <div className="agora-nome">{a.nome}</div>
            <div className="agora-tempo">{cronometro(tempo)}</div>
            <div className="agora-meta">
              {t.nome} · {a.titulo}
            </div>
            <div className="agora-meta">
              desde {hora(a.inicio)}
              {correndo ? "" : " · pausada"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
