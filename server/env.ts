// Variáveis de ambiente da API. Lidas sob demanda (e não no import) para que
// a mesma build rode na Vercel, na VPS ou nos testes com valores diferentes.
// Colar `"valor"` (com aspas) no painel da Vercel grava as aspas junto; tira-as.
function readEnv(name: string) {
  return process.env[name]?.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

export function requireEnv(name: string) {
  const value = readEnv(name);

  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }

  return value;
}

export function optionalEnv(name: string) {
  const value = readEnv(name);
  return value ? value : undefined;
}
