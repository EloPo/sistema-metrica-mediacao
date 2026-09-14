import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { diaBonito, duracao, horas, tipoInfo } from "../formato.js";

const EIXO = { fontSize: 12, fill: "#5f6b7d" };
const dica = {
  contentStyle: { borderRadius: 8, border: "1px solid #dfe4ea", fontSize: 13 },
  formatter: (valor, nome) => [nome === "horas" ? duracao(valor * 3600000) : valor, nome],
};

// Eixos em horas cheias, sem casas decimais.
const emHoras = (v) => `${Math.round(v)}h`;
const inteiro = (v) => String(Math.round(v));

export function TempoPorMediador({ porMediador, aoClicar }) {
  const dados = porMediador
    .filter((m) => m.tarefas > 0)
    .map((m) => ({
      id: m.id,
      nome: m.nome.split(" ")[0] + " " + (m.nome.split(" ")[1]?.[0] ? m.nome.split(" ")[1][0] + "." : ""),
      horas: horas(m.liquido_ms),
      demandas: m.tarefas,
    }));

  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 42)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 18 }}>
        <CartesianGrid horizontal={false} stroke="#eef1f4" />
        <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={emHoras} />
        <YAxis type="category" dataKey="nome" width={92} tick={EIXO} axisLine={false} tickLine={false} />
        <Tooltip {...dica} cursor={{ fill: "#f4f6f8" }} />
        <Bar
          dataKey="horas"
          fill="#1b2434"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          onClick={(barra) => aoClicar?.(barra.id)}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DivisaoPorTipo({ porTipo }) {
  const dados = porTipo.map((t) => ({
    nome: tipoInfo(t.tipo).curto,
    cor: tipoInfo(t.tipo).cor,
    horas: horas(t.liquido_ms),
    demandas: t.tarefas,
  }));

  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={dados} dataKey="horas" nameKey="nome" innerRadius={58} outerRadius={92} paddingAngle={2}>
          {dados.map((d) => (
            <Cell key={d.nome} fill={d.cor} stroke="#fff" />
          ))}
        </Pie>
        <Tooltip {...dica} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12.5 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SerieDoPeriodo({ porDia, porHora, umDiaSo }) {
  if (umDiaSo) {
    const dados = porHora.map((h) => ({
      rotulo: String(h.hora).padStart(2, "0") + "h",
      horas: horas(h.liquido_ms),
      demandas: h.tarefas,
    }));
    if (!dados.length) return <p className="vazio">Sem registros no período.</p>;
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ left: -18, right: 8 }}>
          <CartesianGrid vertical={false} stroke="#eef1f4" />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={inteiro} allowDecimals={false} />
          <Tooltip {...dica} cursor={{ fill: "#f4f6f8" }} />
          <Bar dataKey="demandas" fill="#2F5FD0" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const dados = porDia.map((d) => ({
    rotulo: diaBonito(d.dia),
    horas: horas(d.liquido_ms),
    demandas: d.tarefas,
  }));
  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ left: -18, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#eef1f4" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={inteiro} allowDecimals={false} />
        <Tooltip {...dica} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12.5 }} />
        <Line type="monotone" dataKey="horas" stroke="#0E7C66" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="demandas" stroke="#2F5FD0" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
