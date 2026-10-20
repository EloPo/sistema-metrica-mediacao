import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { diaBonito, duracao, horas, tipoInfo } from "../formato.js";

const EIXO = { fontSize: 12, fill: "#5f6b7d" };
const emHoras = (v) => `${Math.round(v)}h`;
const inteiro = (v) => String(Math.round(v));

// Tudo que termina com "horas" no nome da série vira hora cheia no balão.
const dica = {
  contentStyle: { borderRadius: 8, border: "1px solid #dfe4ea", fontSize: 13 },
  formatter: (valor, nome) => [
    /hora|jornada|meta|dedicado/i.test(nome) ? duracao(valor * 3600000) : valor,
    nome,
  ],
};

export function TempoPorMediador({ porMediador, aoClicar }) {
  const dados = porMediador
    .filter((m) => m.jornada_ms > 0 || m.meta_ms > 0)
    .map((m) => {
      const partes = m.nome.split(" ");
      return {
        id: m.id,
        nome: partes[0] + (partes[1] ? " " + partes[1][0] + "." : ""),
        jornada: horas(m.jornada_ms),
        meta: horas(m.meta_ms),
      };
    });

  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={60 + dados.length * 54}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 18 }}>
        <CartesianGrid horizontal={false} stroke="#eef1f4" />
        <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={emHoras} />
        <YAxis type="category" dataKey="nome" width={92} tick={EIXO} axisLine={false} tickLine={false} />
        <Tooltip {...dica} cursor={{ fill: "#f4f6f8" }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12.5 }} />
        <Bar
          dataKey="jornada"
          name="jornada"
          fill="#1b2434"
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
          onClick={(barra) => aoClicar?.(barra.id)}
          cursor="pointer"
        />
        <Bar dataKey="meta" name="meta" fill="#c9d1da" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DivisaoPorTipo({ porTipo }) {
  const dados = porTipo.map((t) => ({
    nome: tipoInfo(t.tipo).curto,
    cor: tipoInfo(t.tipo).cor,
    dedicado: horas(t.esforco_ms),
    demandas: t.tarefas,
  }));

  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={dados} dataKey="dedicado" nameKey="nome" innerRadius={58} outerRadius={92} paddingAngle={2}>
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
    jornada: horas(d.jornada_ms),
    meta: horas(d.meta_ms),
  }));
  if (!dados.length) return <p className="vazio">Sem registros no período.</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ left: -18, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#eef1f4" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={emHoras} />
        <Tooltip {...dica} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12.5 }} />
        <Line type="monotone" dataKey="jornada" stroke="#0E7C66" strokeWidth={2} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="meta"
          stroke="#9aa5b1"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
