import { useEffect, useRef, useState } from "react";
import { diaISO, somarDias } from "../formato.js";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ATALHOS = [
  { rotulo: "Hoje", de: () => diaISO(), ate: () => diaISO() },
  { rotulo: "Ontem", de: () => somarDias(-1), ate: () => somarDias(-1) },
  { rotulo: "7 dias", de: () => somarDias(-6), ate: () => diaISO() },
  { rotulo: "30 dias", de: () => somarDias(-29), ate: () => diaISO() },
  { rotulo: "Este mês", de: () => diaISO(primeiroDoMes()), ate: () => diaISO() },
];

function primeiroDoMes() {
  const d = new Date();
  d.setDate(1);
  return d;
}

// Lista os dias que o mês mostra, começando no domingo da primeira semana.
function gradeDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

const rotuloPeriodo = (de, ate) => {
  const f = (iso) => new Date(iso + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (de === ate) {
    return de === diaISO() ? "Hoje" : f(de);
  }
  return `${f(de)} – ${f(ate)}`;
};

// Escolha de período por calendário: clique no primeiro dia e depois no último.
export default function Calendario({ de, ate, aoEscolher }) {
  const [aberto, setAberto] = useState(false);
  const [inicioParcial, setInicioParcial] = useState(null);
  const [mesVisivel, setMesVisivel] = useState(() => {
    const base = new Date(ate + "T12:00");
    return { ano: base.getFullYear(), mes: base.getMonth() };
  });
  const caixa = useRef(null);

  // Fecha ao clicar fora ou apertar Esc, como qualquer menu suspenso.
  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (e) => {
      if (caixa.current && !caixa.current.contains(e.target)) fechar();
    };
    const tecla = (e) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setInicioParcial(null);
  }

  function clicarNoDia(iso) {
    if (!inicioParcial) {
      setInicioParcial(iso);
      return;
    }
    // O segundo clique fecha o intervalo, em qualquer ordem.
    const [d1, d2] = [inicioParcial, iso].sort();
    aoEscolher(d1, d2);
    fechar();
  }

  function usarAtalho(a) {
    aoEscolher(a.de(), a.ate());
    fechar();
  }

  const hoje = diaISO();
  const dias = gradeDoMes(mesVisivel.ano, mesVisivel.mes);
  // Enquanto só há um clique, o intervalo mostrado é o que está sendo montado.
  const faixaDe = inicioParcial || de;
  const faixaAte = inicioParcial || ate;

  function mudarMes(passo) {
    setMesVisivel(({ ano, mes }) => {
      const d = new Date(ano, mes + passo, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  return (
    <div className="calendario" ref={caixa}>
      <button
        type="button"
        className={"btn calendario-gatilho" + (aberto ? " ativo" : "")}
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-expanded={aberto}
      >
        {rotuloPeriodo(de, ate)}
      </button>

      {aberto && (
        <div className="calendario-painel" role="dialog" aria-label="Escolher período">
          <div className="calendario-atalhos">
            {ATALHOS.map((a) => (
              <button key={a.rotulo} type="button" className="calendario-atalho" onClick={() => usarAtalho(a)}>
                {a.rotulo}
              </button>
            ))}
          </div>

          <div className="calendario-grade">
            <div className="calendario-topo">
              <button type="button" className="calendario-seta" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
                ‹
              </button>
              <span className="calendario-mes">
                {MESES[mesVisivel.mes]} de {mesVisivel.ano}
              </span>
              <button type="button" className="calendario-seta" onClick={() => mudarMes(1)} aria-label="Próximo mês">
                ›
              </button>
            </div>

            <div className="calendario-semana">
              {SEMANA.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="calendario-dias">
              {dias.map((d) => {
                const iso = diaISO(d);
                const doMes = d.getMonth() === mesVisivel.mes;
                const futuro = iso > hoje;
                const dentro = iso >= faixaDe && iso <= faixaAte;
                const extremo = iso === faixaDe || iso === faixaAte;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={futuro}
                    onClick={() => clicarNoDia(iso)}
                    className={
                      "calendario-dia" +
                      (doMes ? "" : " fora") +
                      (dentro ? " dentro" : "") +
                      (extremo ? " extremo" : "") +
                      (iso === hoje ? " hoje" : "")
                    }
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <p className="calendario-dica">
              {inicioParcial
                ? "Agora clique no último dia do período."
                : "Clique no primeiro dia do período."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
