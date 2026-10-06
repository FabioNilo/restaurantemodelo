import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMesaContaReceiptLines, downloadPedidoThermalLabelPdf } from './thermal-label-pdf';

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
    expect(pdfText).toContain('NOSSO BISTRO CAFE');
    expect(pdfText).not.toContain('PASTA BRASILIANA');
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

describe('buildMesaContaReceiptLines', () => {
  const item = (nome: string, preco: number, quantidade: number) => ({
    produto_id: nome,
    nome,
    tamanho_codigo: null,
    tamanho_nome: null,
    tamanho_serve: null,
    preco,
    quantidade,
  });
  const pedidos = [
    { status: 'entregue' as const, nome_cliente: 'Ana', created_at: '', itens: [item('Café', 5, 2)] },
    { status: 'novo' as const, nome_cliente: null, created_at: '', itens: [item('Bolo', 10, 1)] },
    { status: 'cancelado' as const, nome_cliente: 'Beto', created_at: '', itens: [item('Suco', 7, 1)] },
  ];
  const texto = (modo: 'resumo' | 'pessoas') => buildMesaContaReceiptLines(pedidos, 'Mesa 3', modo).map((linha) => linha.text);

  it('por pessoa: cada nome com subtotal, "sem nome" no fim e total da mesa', () => {
    const linhas = texto('pessoas');
    expect(linhas).toContain('ANA');
    expect(linhas).toContain('SUBTOTAL: R$ 10,00');
    expect(linhas).toContain('SEM NOME');
    expect(linhas).toContain('TOTAL: R$ 20,00');
    expect(linhas.join('\n')).not.toContain('SUCO');
  });

  it('resumo: itens somados, sem seção por pessoa', () => {
    const linhas = texto('resumo');
    expect(linhas).toContain('2x CAFE'.replace('CAFE', 'CAFÉ'));
    expect(linhas).not.toContain('ANA');
    expect(linhas).toContain('TOTAL: R$ 20,00');
  });
});
