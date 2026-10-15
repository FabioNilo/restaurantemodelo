import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROTA_INICIAL_ADMIN } from './admin-home';

const arquivo = (caminho: string) => readFileSync(path.resolve(process.cwd(), caminho), 'utf8');

describe('tela inicial do painel (Balcão, para todos os perfis)', () => {
  it('é o Balcão', () => {
    expect(ROTA_INICIAL_ADMIN).toBe('/admin/balcao');
  });

  it('o app instalado abre no mesmo lugar (start_url do manifest)', () => {
    const manifest = JSON.parse(arquivo('public/admin/manifest.webmanifest'));
    expect(manifest.start_url).toBe(ROTA_INICIAL_ADMIN);
    expect(manifest.shortcuts[0].url).toBe(ROTA_INICIAL_ADMIN);
  });

  it('a notificação sem destino também leva ao Balcão', () => {
    const sw = arquivo('public/admin/sw.js');
    expect(sw.match(new RegExp(`'${ROTA_INICIAL_ADMIN}'`, 'g'))?.length).toBe(2);
    expect(sw).not.toContain("'/admin/mesas'");
  });

  it('o /admin redireciona para essa rota e o Balcão é o primeiro item do menu', () => {
    expect(arquivo('src/App.tsx')).toContain('<Navigate to={ROTA_INICIAL_ADMIN} replace />');
    const layout = arquivo('src/pages/admin/AdminLayout.tsx');
    expect(layout.indexOf("to: '/admin/balcao'")).toBeGreaterThan(0);
    expect(layout.indexOf("to: '/admin/balcao'")).toBeLessThan(layout.indexOf("to: '/admin/mesas'"));
  });
});
