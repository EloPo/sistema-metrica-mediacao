// Envolve handlers async para que um erro vire resposta 500 em vez de derrubar o servidor.
export const assinc = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
