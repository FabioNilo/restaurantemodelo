import type { MarmitaListItem } from '@/types/product';

// Produto fixo para os testes de carrinho/checkout, independente do cardápio
// real em src/data/cardapio.ts (que muda conforme o cliente).
export const produtoComTamanhos: MarmitaListItem = {
  id: 'file-ao-molho-madeira',
  categoria_id: 'pratos-principais',
  nome: 'Filé ao Molho Madeira',
  descricao: 'Filé mignon ao ponto com molho madeira encorpado e arroz soltinho.',
  preco: 42,
  estoque: 99,
  disponivel: true,
  imagem_url: '/file-ao-molho-madeira.jpg',
  permite_troca_massa: false,
  tamanhos: [
    { codigo: 'tamanho_m', nome: 'M', serve: 'Serve 1 pessoa', preco: 42 },
    { codigo: 'tamanho_g', nome: 'G', serve: 'Serve 2 pessoas', preco: 78 },
  ],
};
