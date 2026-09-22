import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPedidoThermalLabelPdf } from './thermal-label-pdf';

describe('downloadPedidoThermalLabelPdf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a complete thermal order receipt PDF', async () => {
    let generatedBlob: Blob | MediaSource | null = null;
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      generatedBlob = blob;
      return 'blob:pedido';
    });
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadPedidoThermalLabelPdf(
      {
        id: '1024',
        nome_cliente: 'Maria',
        telefone_cliente: '7399999-9999',
        bairro_cliente: 'Centro',
        complemento_cliente: 'Prox. farmacia',
        endereco_cliente: 'Rua Principal',
        observacoes_cliente: 'Chamar no WhatsApp',
        forma_pagamento: 'pix',
        tipo_entrega: 'delivery',
        subtotal: 72,
        taxa_entrega: 5,
        valor_total: 77,
        created_at: '2026-06-28T22:42:00.000Z',
      },
      [
        {
          quantidade: 1,
          nome: 'Talharim bolonhesa',
          preco: 42,
          tamanho_nome: 'Medio',
          observacao: 'Sem cebola',
        },
        {
          quantidade: 2,
          nome: 'Nhoque ao sugo',
          preco: 15,
          tamanho_nome: 'Pequeno',
        },
      ]
    );

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:pedido');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(generatedBlob).toBeInstanceOf(Blob);

    const pdfBlob = generatedBlob instanceof Blob ? generatedBlob : null;
    expect(pdfBlob).not.toBeNull();
    const pdfText = await pdfBlob!.text();
    expect(pdfText).toContain('PASTA BRASILIANA');
    expect(pdfText).toContain('COMPROVANTE DO PEDIDO');
    expect(pdfText).toContain('/BaseFont /Courier-BoldOblique');
    expect(pdfText).not.toContain('Rua Quirino Cardoso, 86 - Conquista');
    expect(pdfText).not.toContain('Ilheus - BA, CEP: 45650-280');
    expect(pdfText).not.toContain('PEDIDO #1024');
    expect(pdfText).toContain('CLIENTE');
    expect(pdfText).toContain('DATA: 28/06 19:42');
    expect(pdfText).toContain('NOME: MARIA');
    expect(pdfText).toContain('END: RUA PRINCIPAL - CENTRO');
    expect(pdfText).toContain('1x TALHARIM BOLONHESA');
    expect(pdfText).toContain('TAM: MEDIO');
    expect(pdfText).toContain('OBS: SEM CEBOLA');
    expect(pdfText).toContain('2x NHOQUE AO SUGO');
    expect(pdfText).toContain('REF: PROX. FARMACIA');
    expect(pdfText).toContain('PAGAMENTO: PIX');
    expect(pdfText).not.toContain('SUBTOTAL:');
    expect(pdfText).toContain('ENTREGA: R$ 5,00');
    expect(pdfText).toContain('TOTAL: R$ 77,00');
    expect(pdfText).toContain('OBS GERAL:');
    expect(pdfText).toContain('CHAMAR NO WHATSAPP');
    expect(pdfText).toContain('IMPRESSO PELO SITE');
  });

  it('calculates delivery fee from total and items when the backend does not send the fee', async () => {
    let generatedBlob: Blob | MediaSource | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      generatedBlob = blob;
      return 'blob:pedido';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadPedidoThermalLabelPdf(
      {
        id: '1025',
        nome_cliente: 'Maria',
        telefone_cliente: '7399999-9999',
        bairro_cliente: 'Centro',
        complemento_cliente: 'Prox. farmacia',
        endereco_cliente: 'Rua Principal',
        observacoes_cliente: null,
        forma_pagamento: 'pix',
        tipo_entrega: 'delivery',
        valor_total: 77,
        created_at: '2026-06-28T22:42:00.000Z',
      },
      [
        { quantidade: 1, nome: 'Talharim bolonhesa', preco: 42 },
        { quantidade: 2, nome: 'Nhoque ao sugo', preco: 15 },
      ]
    );

    expect(generatedBlob).toBeInstanceOf(Blob);
    const pdfBlob = generatedBlob instanceof Blob ? generatedBlob : null;
    expect(pdfBlob).not.toBeNull();
    const pdfText = await pdfBlob!.text();
    expect(pdfText).toContain('ENTREGA: R$ 5,00');
    expect(pdfText).toContain('TOTAL: R$ 77,00');
  });
});
