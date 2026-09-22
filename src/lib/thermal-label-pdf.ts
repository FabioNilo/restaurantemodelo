interface ThermalLabelItem {
  quantidade?: number;
  nome?: string;
  preco?: number;
  valor_total?: number;
  total?: number;
  tamanho_nome?: string;
  tamanho_serve?: string;
  observacao?: string | null;
  observacoes?: string | null;
  observacoes_item?: string | null;
}

interface ThermalLabelPedido {
  id: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  bairro_cliente: string | null;
  complemento_cliente: string | null;
  endereco_cliente: string | null;
  observacoes_cliente: string | null;
  forma_pagamento?: string | null;
  tipo_entrega?: string | null;
  subtotal?: number | null;
  taxa_entrega?: number | null;
  valor_entrega?: number | null;
  delivery_fee?: number | null;
  valor_total: number;
  created_at: string | null;
}

const MM_TO_PT = 2.8346456693;
const LABEL_WIDTH_MM = 80;
const LABEL_MIN_HEIGHT_MM = 80;
const LABEL_WIDTH_PT = LABEL_WIDTH_MM * MM_TO_PT;
const LABEL_MIN_HEIGHT_PT = LABEL_MIN_HEIGHT_MM * MM_TO_PT;
const LABEL_MARGIN_PT = 8;
const MAX_TEXT_WIDTH_PT = LABEL_WIDTH_PT - LABEL_MARGIN_PT * 2;
const DIVIDER = '--------------------------------';

type ReceiptLine = {
  text: string;
  font?: 'regular' | 'bold' | 'title' | 'itemName';
  align?: 'left' | 'center';
};

type LineStyleKey = NonNullable<ReceiptLine['font']>;

// Todo o cupom sai em negrito (Courier-Bold/BoldOblique, nunca a fonte
// "regular" fina) e em negrito duplo (cada linha e desenhada duas vezes
// com um leve deslocamento horizontal) - a impressora termica imprimia
// tudo muito claro com a fonte fina no tamanho antigo. "itemName" continua
// o maior, por ser a informacao mais importante pra quem prepara o pedido.
const LINE_STYLES: Record<LineStyleKey, { size: number; leading: number }> = {
  regular: { size: 9.5, leading: 12 },
  bold: { size: 10, leading: 13 },
  title: { size: 15, leading: 10.8 },
  itemName: { size: 11, leading: 14 },
};

const DOUBLE_STRIKE_OFFSET_PT = 0.35;

function getLineStyle(line: ReceiptLine) {
  return LINE_STYLES[line.font ?? 'regular'];
}

function sanitizePdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[()\\]/g, (match) => `\\${match}`);
}

function compactText(value: string | null | undefined, fallback = '-') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function getShortPedidoId(id: string) {
  const text = compactText(id);
  const onlyNumbers = text.match(/\d+/g)?.join('');
  return (onlyNumbers || text).slice(-8).toUpperCase();
}

function getPaymentLabel(value?: string | null) {
  const normalized = compactText(value, '').toLowerCase();
  if (normalized === 'cartao_credito' || normalized === 'cartao') return 'CARTAO DE CREDITO';
  if (normalized === 'pix') return 'PIX';
  return compactText(value, '-').toUpperCase();
}

function getItemTotal(item: ThermalLabelItem) {
  const quantity = item.quantidade ?? 1;
  return Number(item.valor_total ?? item.total ?? (Number(item.preco) || 0) * quantity) || 0;
}

function getVariationDetailLabel(value?: string | null) {
  return /\b\d+\s*(ml|l)\b/i.test(value ?? '') ? 'VOL' : 'SERVE';
}

function getDeliveryFee(pedido: ThermalLabelPedido, items: ThermalLabelItem[]) {
  const explicitFee = pedido.taxa_entrega ?? pedido.valor_entrega ?? pedido.delivery_fee;

  if (explicitFee !== undefined && explicitFee !== null && Number.isFinite(Number(explicitFee))) {
    return Number(explicitFee);
  }

  const total = Number(pedido.valor_total) || 0;
  const itemsTotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  return Math.max(0, total - itemsTotal);
}

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.6;
}

function wrapLine(text: string, fontSize: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (estimateTextWidth(candidate, fontSize) <= MAX_TEXT_WIDTH_PT) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (estimateTextWidth(word, fontSize) <= MAX_TEXT_WIDTH_PT) {
      current = word;
      continue;
    }

    const maxChars = Math.max(4, Math.floor(MAX_TEXT_WIDTH_PT / (fontSize * 0.48)));
    lines.push(word.slice(0, maxChars - 1) + '-');
    current = word.slice(maxChars - 1);
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildReceiptLines(pedido: ThermalLabelPedido, items: ThermalLabelItem[]): ReceiptLine[] {
  const createdAt = pedido.created_at
    ? new Date(pedido.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    : '';
  const createdTime = pedido.created_at
    ? new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const itemLines = items.flatMap((item, index) => {
    const quantity = item.quantidade ?? 1;
    const itemTotal = getItemTotal(item);
    const notes = compactText(item.observacoes_item || item.observacoes || item.observacao, '');
    const lines: ReceiptLine[] = [
      index > 0 ? { text: '' } : null,
      { text: `${quantity}x ${compactText(item.nome, 'ITEM').toUpperCase()}`, font: 'itemName' },
      item.tamanho_nome ? { text: `TAM: ${compactText(item.tamanho_nome).toUpperCase()}` } : null,
      item.tamanho_serve ? { text: `${getVariationDetailLabel(item.tamanho_serve)}: ${compactText(item.tamanho_serve).toUpperCase()}` } : null,
      itemTotal > 0 ? { text: `VALOR: ${formatCurrency(itemTotal)}` } : null,
      notes ? { text: `OBS: ${notes.toUpperCase()}` } : null,
    ].filter(Boolean) as ReceiptLine[];

    return lines;
  });

  const total = Number(pedido.valor_total) || 0;
  const deliveryFee = getDeliveryFee(pedido, items);
  const deliveryAddress = [
    compactText(pedido.endereco_cliente, ''),
    compactText(pedido.bairro_cliente, ''),
  ].filter(Boolean).join(' - ');

  return [
    { text: 'PASTA BRASILIANA', font: 'title', align: 'center' },
    { text: 'COMPROVANTE DO PEDIDO', font: 'bold', align: 'center' },
    { text: DIVIDER, align: 'center' },
    { text: `DATA: ${compactText(`${createdAt} ${createdTime}`.trim())}` },
    { text: 'CLIENTE', font: 'bold', align: 'center' },
    { text: `NOME: ${compactText(pedido.nome_cliente).toUpperCase()}` },
    { text: `TEL: ${compactText(pedido.telefone_cliente)}` },
    { text: `END: ${compactText(deliveryAddress).toUpperCase()}` },
    { text: `REF: ${compactText(pedido.complemento_cliente).toUpperCase()}` },
    { text: DIVIDER, align: 'center' },
    { text: 'PEDIDO', font: 'bold', align: 'center' },
    ...itemLines,
    { text: DIVIDER, align: 'center' },
    { text: `PAGAMENTO: ${getPaymentLabel(pedido.forma_pagamento)}` },
    { text: `ENTREGA: ${formatCurrency(deliveryFee)}` },
    { text: `TOTAL: ${formatCurrency(total)}`, font: 'bold' },
    pedido.observacoes_cliente ? { text: '' } : null,
    pedido.observacoes_cliente ? { text: 'OBS GERAL:', font: 'bold' } : null,
    pedido.observacoes_cliente ? { text: compactText(pedido.observacoes_cliente).toUpperCase() } : null,
    { text: '' },
    { text: DIVIDER, align: 'center' },
    { text: '' },
    { text: 'IMPRESSO PELO SITE', align: 'center' },
  ].filter(Boolean) as ReceiptLine[];
}

function getPdfFont(line: ReceiptLine) {
  return line.font === 'title' ? 'F3' : 'F2';
}

function wrapReceiptLines(lines: ReceiptLine[]) {
  return lines.flatMap((line) => {
    if (!line.text) return [{ ...line, text: '' }];
    const fontSize = getLineStyle(line).size;
    return wrapLine(line.text, fontSize).map((text) => ({ ...line, text }));
  });
}

function getLineX(line: ReceiptLine, fontSize: number) {
  if (line.align !== 'center') return LABEL_MARGIN_PT;
  const textWidth = estimateTextWidth(line.text, fontSize);
  return Math.max(LABEL_MARGIN_PT, (LABEL_WIDTH_PT - textWidth) / 2);
}

function buildContentStream(layout: ReturnType<typeof prepareLayout>) {
  const contentLines = ['BT'];
  const firstStyle = getLineStyle(layout.lines[0] ?? { text: '' });
  let y = layout.pageHeight - LABEL_MARGIN_PT - firstStyle.size;

  layout.lines.forEach((line) => {
    const style = getLineStyle(line);
    const font = getPdfFont(line);
    const x = getLineX(line, style.size);
    contentLines.push(`/${font} ${style.size} Tf`);
    contentLines.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${sanitizePdfText(line.text)}) Tj`);
    if (line.text) {
      const doubleStrikeX = x + DOUBLE_STRIKE_OFFSET_PT;
      contentLines.push(`1 0 0 1 ${doubleStrikeX.toFixed(2)} ${y.toFixed(2)} Tm (${sanitizePdfText(line.text)}) Tj`);
    }
    y -= style.leading;
  });

  contentLines.push('ET');
  return contentLines.join('\n');
}

function prepareLayout(lines: ReceiptLine[]) {
  const wrapped = wrapReceiptLines(lines);
  const firstStyle = getLineStyle(wrapped[0] ?? { text: '' });
  const totalLeading = wrapped.slice(1).reduce((sum, line) => sum + getLineStyle(line).leading, 0);
  const contentHeight = firstStyle.size + totalLeading;
  const pageHeight = Math.max(LABEL_MIN_HEIGHT_PT, contentHeight + LABEL_MARGIN_PT * 2);

  return {
    lines: wrapped,
    pageHeight,
  };
}

function buildPdf(contentStream: string, pageHeight: number) {
  const encoder = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LABEL_WIDTH_PT.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-BoldOblique >>',
    `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadPedidoThermalLabelPdf(pedido: ThermalLabelPedido, items: ThermalLabelItem[]) {
  const layout = prepareLayout(buildReceiptLines(pedido, items));
  const blob = buildPdf(buildContentStream(layout), layout.pageHeight);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `impressao-pedido-${getShortPedidoId(pedido.id)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
