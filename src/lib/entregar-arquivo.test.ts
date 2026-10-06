import { afterEach, describe, expect, it, vi } from 'vitest';
import { entregarArquivo } from './entregar-arquivo';

const blob = new Blob(['%PDF'], { type: 'application/pdf' });

function simularDispositivo({ toque, share }: { toque: boolean; share?: ReturnType<typeof vi.fn> }) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: toque && query.includes('coarse') }) as MediaQueryList);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: share ? () => true : undefined });
}

function espionarDownload() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('entregarArquivo', () => {
  it('no celular abre o compartilhar e não baixa', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    simularDispositivo({ toque: true, share });
    const click = espionarDownload();

    expect(await entregarArquivo(blob, 'conta.pdf')).toBe('compartilhado');
    expect(share.mock.calls[0][0].files[0].name).toBe('conta.pdf');
    expect(click).not.toHaveBeenCalled();
  });

  it('se a pessoa cancelar o compartilhar, não baixa por trás', async () => {
    simularDispositivo({ toque: true, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
    const click = espionarDownload();

    expect(await entregarArquivo(blob, 'conta.pdf')).toBe('cancelado');
    expect(click).not.toHaveBeenCalled();
  });

  it('no computador (ou sem suporte) baixa o arquivo', async () => {
    const share = vi.fn();
    simularDispositivo({ toque: false, share });
    const click = espionarDownload();

    expect(await entregarArquivo(blob, 'conta.pdf')).toBe('baixado');
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
  });
});
