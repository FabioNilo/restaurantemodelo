// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { optionalEnv, requireEnv } from './env.js';

describe('env helpers', () => {
  afterEach(() => {
    delete process.env.TESTE_ENV;
  });

  it('tira aspas e espaços colados junto do valor', () => {
    process.env.TESTE_ENV = ' "us-east-1" ';
    expect(requireEnv('TESTE_ENV')).toBe('us-east-1');
    process.env.TESTE_ENV = "'abc'";
    expect(optionalEnv('TESTE_ENV')).toBe('abc');
  });

  it('mantém valores sem aspas e rejeita vazio', () => {
    process.env.TESTE_ENV = 'valor';
    expect(requireEnv('TESTE_ENV')).toBe('valor');
    process.env.TESTE_ENV = '""';
    expect(() => requireEnv('TESTE_ENV')).toThrow('não configurada');
  });
});
