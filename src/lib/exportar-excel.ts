import type { MovimentoCaixa } from '@/features/integrations/painel-contracts';
import { nomeArquivoFluxoCaixa, planilhasFluxoCaixa } from '@/lib/fluxo-caixa';

const MOEDA = '"R$" #,##0.00';
const VERDE = 'FF1E3A22';
const DOURADO = 'FFC9A962';

// Gera o .xlsx do fluxo de caixa. O exceljs (~1 MB) só é baixado quando a
// pessoa clica em "Exportar Excel", para não pesar o site.
export async function gerarExcelFluxoCaixa(movimentos: MovimentoCaixa[], periodo: { de: string; ate: string }) {
  const { default: ExcelJS } = await import('exceljs');
  const dados = planilhasFluxoCaixa(movimentos, periodo);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nosso Bistrô Café';
  wb.created = new Date();

  const cabecalho = (row: { font?: unknown; fill?: unknown; eachCell: (fn: (cell: { font: unknown; fill: unknown }) => void) => void }) =>
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    });

  // Resumo
  const resumo = wb.addWorksheet('Resumo');
  resumo.columns = [{ width: 28 }, { width: 22 }];
  dados.resumo.forEach((linha) => resumo.addRow(linha));
  resumo.getCell('A1').font = { bold: true, size: 14, color: { argb: VERDE } };
  ['A6', 'A11'].forEach((ref) => {
    resumo.getRow(Number(ref.slice(1))).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    });
  });
  resumo.getCell('B4').font = { bold: true, color: { argb: VERDE } };
  resumo.eachRow((row, numero) => {
    if (numero >= 4) {
      const cell = row.getCell(2);
      if (typeof cell.value === 'number') cell.numFmt = MOEDA;
    }
  });

  // Movimentações
  const mov = wb.addWorksheet('Movimentações');
  mov.columns = [{ width: 12 }, { width: 8 }, { width: 10 }, { width: 20 }, { width: 24 }, { width: 20 }, { width: 14 }];
  cabecalho(mov.addRow(dados.movimentacoes.cabecalho));
  dados.movimentacoes.linhas.forEach((linha) => mov.addRow(linha));
  mov.getColumn(7).numFmt = MOEDA;
  mov.autoFilter = { from: 'A1', to: `G${Math.max(dados.movimentacoes.linhas.length + 1, 1)}` };
  mov.views = [{ state: 'frozen', ySplit: 1 }];
  const totalMov = mov.addRow(['', '', '', '', '', 'Total', dados.movimentacoes.total]);
  totalMov.font = { bold: true };
  totalMov.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DOURADO } };

  // Por dia
  const dia = wb.addWorksheet('Por dia');
  dia.columns = [{ width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  cabecalho(dia.addRow(dados.porDia.cabecalho));
  dados.porDia.linhas.forEach((linha) => dia.addRow(linha));
  [2, 3, 4, 5].forEach((col) => (dia.getColumn(col).numFmt = MOEDA));
  dia.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivoFluxoCaixa(periodo);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
