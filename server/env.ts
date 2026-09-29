// Variáveis de ambiente da API. Lidas sob demanda (e não no import) para que
// a mesma build rode na Vercel, na VPS ou nos testes com valores diferentes.
export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }

  return value;
}

export function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
