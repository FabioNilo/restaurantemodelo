// Entrega um arquivo gerado no navegador (cupom, conta, planilha).
// No celular abre o menu "Compartilhar" (app da impressora térmica, WhatsApp, Drive),
// para não deixar o arquivo perdido na pasta Downloads. No computador, ou se o
// navegador não compartilha arquivos, baixa como antes.
export async function entregarArquivo(blob: Blob, nome: string) {
  const tipo = blob.type || 'application/octet-stream';
  const arquivo = typeof File === 'function' ? new File([blob], nome, { type: tipo }) : null;
  const toque = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  if (arquivo && toque && typeof navigator.share === 'function' && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return 'compartilhado' as const;
    } catch (error) {
      // A pessoa fechou o menu: não é erro e não deve baixar por trás.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado' as const;
    }
  }

  baixarArquivo(blob, nome);
  return 'baixado' as const;
}

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
