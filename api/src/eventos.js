// Canal de tempo real: o painel abre um EventSource e recebe um aviso
// sempre que alguma extensão manda novidade.
const inscritos = new Set();

export function inscrever(res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 5000\n\n");
  inscritos.add(res);
  return () => inscritos.delete(res);
}

export function avisar(evento, dados = {}) {
  const linha = `event: ${evento}\ndata: ${JSON.stringify({ ...dados, em: Date.now() })}\n\n`;
  for (const res of inscritos) {
    try {
      res.write(linha);
    } catch {
      inscritos.delete(res);
    }
  }
}

// Mantém a conexão viva atrás de proxies que derrubam streams ociosos.
setInterval(() => {
  for (const res of inscritos) {
    try {
      res.write(": ping\n\n");
    } catch {
      inscritos.delete(res);
    }
  }
}, 25000).unref?.();

export const totalInscritos = () => inscritos.size;
