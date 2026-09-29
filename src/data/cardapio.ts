import type { CategoriaListItem, MarmitaListItem, ProdutoTamanho } from '@/types/product';

// Cardápio do Nosso Bistrô Café, transcrito do PDF de delivery em
// docs/Nosso Bistro Café - Delivery.pdf. Alguns nomes estão cortados
// no PDF ("PICOLE SABOR C...") — esses ficam marcados com "(a confirmar)"
// e estão listados no README, em "Pendências com o cliente".
//
// Itens com vários sabores/tamanhos viram um produto só, com as opções em
// `tamanhos` (nome = sabor/tamanho, serve = detalhe opcional, preco).
export const categoriasCardapio: CategoriaListItem[] = [
  { id: 'promocao-do-dia', nome: 'Promoção do dia', ordem: 1 },
  { id: 'tortas', nome: 'Tortas', ordem: 2 },
  { id: 'salgados', nome: 'Salgados', ordem: 3 },
  { id: 'cafes', nome: 'Cafés', ordem: 4 },
  { id: 'refrigerantes', nome: 'Refrigerantes', ordem: 5 },
  { id: 'bolos-caseiros', nome: 'Bolos caseiros', ordem: 6 },
  { id: 'biscoitos', nome: 'Biscoitos', ordem: 7 },
  { id: 'aguas', nome: 'Águas', ordem: 8 },
  { id: 'picoles', nome: 'Picolés e sorvetes', ordem: 9 },
  { id: 'doces', nome: 'Doces', ordem: 10 },
  { id: 'polpas', nome: 'Polpas', ordem: 11 },
  { id: 'sobremesas', nome: 'Sobremesas', ordem: 12 },
  { id: 'licores', nome: 'Licores', ordem: 13 },
  { id: 'bomboniere', nome: 'Bomboniere', ordem: 14 },
];

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function opcao(nome: string, preco: number, serve = ''): ProdutoTamanho {
  return { codigo: `opcao_${slug(nome)}`, nome, serve, preco };
}

interface ItemInput {
  id: string;
  categoria_id: string;
  nome: string;
  preco: number;
  descricao?: string;
  opcoes?: ProdutoTamanho[];
  disponivel?: boolean;
}

function item({ id, categoria_id, nome, preco, descricao, opcoes = [], disponivel = true }: ItemInput): MarmitaListItem {
  return {
    id,
    categoria_id,
    nome,
    descricao: descricao ?? null,
    preco: opcoes.length > 0 ? Math.min(...opcoes.map((o) => o.preco)) : preco,
    estoque: disponivel ? 99 : 0,
    disponivel,
    // Sem fotos por enquanto: o card mostra o fallback com ícone da categoria.
    // O dono sobe as fotos reais pelo admin.
    imagem_url: null,
    permite_troca_massa: false,
    tamanhos: opcoes,
  };
}

export const produtosCardapio: MarmitaListItem[] = [
  // --- Promoção do dia ---
  item({ id: 'promo-2-fatias-30', categoria_id: 'promocao-do-dia', nome: '2 fatias de torta', preco: 30, descricao: 'Duas fatias de torta à sua escolha.' }),
  item({ id: 'promo-2-fatias-torta-25', categoria_id: 'promocao-do-dia', nome: '2 fatias de torta (promo) (a confirmar)', preco: 25 }),
  item({ id: 'promo-2-fatias-25', categoria_id: 'promocao-do-dia', nome: 'Promoção 2 fatias (a confirmar)', preco: 25 }),
  item({ id: 'promo-combo-light', categoria_id: 'promocao-do-dia', nome: 'Combo light', preco: 16.9 }),
  item({ id: 'promo-salgado', categoria_id: 'promocao-do-dia', nome: 'Salgado promoção (a confirmar)', preco: 10 }),
  item({ id: 'promo-torta', categoria_id: 'promocao-do-dia', nome: 'Torta promoção', preco: 14 }),

  // --- Tortas ---
  item({ id: 'fatia-olho-de-sogra', categoria_id: 'tortas', nome: 'Fatia de torta olho de sogra', preco: 17 }),

  // --- Salgados ---
  item({ id: 'salgado-medio', categoria_id: 'salgados', nome: 'Salgado médio', preco: 4 }),
  item({ id: 'salgado-assado', categoria_id: 'salgados', nome: 'Salgado assado', preco: 2.5 }),
  item({ id: 'misto-quente', categoria_id: 'salgados', nome: 'Misto quente / queijo quente', preco: 6 }),
  item({ id: 'misto-quente-com', categoria_id: 'salgados', nome: 'Misto quente com… (a confirmar)', preco: 8 }),

  // --- Cafés ---
  item({ id: 'cappuccino', categoria_id: 'cafes', nome: 'Cappuccino', preco: 11 }),
  item({ id: 'cappuccino-alpino', categoria_id: 'cafes', nome: 'Cappuccino Alpino (a confirmar)', preco: 12 }),
  item({ id: 'cappuccino-kitkat', categoria_id: 'cafes', nome: 'KitKat (a confirmar)', preco: 11 }),
  item({ id: 'mocha-dois-frades', categoria_id: 'cafes', nome: 'Mocha Dois Frades (a confirmar)', preco: 11, descricao: 'Com chocolate Dois Frades.' }),
  item({ id: 'dois-frades', categoria_id: 'cafes', nome: 'Dois Frades (a confirmar)', preco: 10, descricao: 'Com chocolate Dois Frades.' }),

  // --- Refrigerantes ---
  item({
    id: 'coca-cola-original',
    categoria_id: 'refrigerantes',
    nome: 'Coca-Cola Original',
    preco: 10,
    opcoes: [opcao('Tamanho 1 (a confirmar)', 10), opcao('Tamanho 2 (a confirmar)', 12)],
  }),
  item({
    id: 'guarana-antarctica',
    categoria_id: 'refrigerantes',
    nome: 'Guaraná Antarctica',
    preco: 6,
    opcoes: [opcao('Tradicional', 6), opcao('Opção 2 (a confirmar)', 6)],
  }),
  item({
    id: 'fys',
    categoria_id: 'refrigerantes',
    nome: 'Fys',
    preco: 6,
    opcoes: [opcao('Limão siciliano', 6), opcao('Laranja-pera', 6)],
  }),
  item({
    id: 'schweppes',
    categoria_id: 'refrigerantes',
    nome: 'Schweppes',
    preco: 7,
    opcoes: [opcao('Tônica', 7), opcao('Citrus', 7)],
  }),
  item({ id: 'frutyba', categoria_id: 'refrigerantes', nome: 'Frutyba', preco: 3 }),

  // --- Bolos caseiros ---
  item({ id: 'bolo-aipim', categoria_id: 'bolos-caseiros', nome: 'Bolo de aipim', preco: 22 }),
  item({ id: 'bolo-milho', categoria_id: 'bolos-caseiros', nome: 'Bolo de milho', preco: 22 }),
  item({ id: 'bolo-caseiro-com', categoria_id: 'bolos-caseiros', nome: 'Bolo caseiro com… (a confirmar)', preco: 25 }),
  item({ id: 'bolo-de-cenoura', categoria_id: 'bolos-caseiros', nome: 'Bolo de cenoura', preco: 20 }),
  item({ id: 'bolo-cenoura-sem-preco', categoria_id: 'bolos-caseiros', nome: 'Cenoura (preço a confirmar)', preco: 0, disponivel: false }),
  item({ id: 'bolo-queijo-goiabada', categoria_id: 'bolos-caseiros', nome: 'Bolo de queijo com goiabada', preco: 15 }),
  item({ id: 'bolo-puba-fatia', categoria_id: 'bolos-caseiros', nome: 'Bolo de puba (fatia)', preco: 10 }),
  item({ id: 'bolo-manteiga-200g', categoria_id: 'bolos-caseiros', nome: 'Bolo de manteiga 200 g', preco: 13 }),
  item({ id: 'bolo-maracuja', categoria_id: 'bolos-caseiros', nome: 'Bolo de maracujá', preco: 13 }),
  item({ id: 'bolo-mesclado', categoria_id: 'bolos-caseiros', nome: 'Bolo mesclado', preco: 13 }),
  item({ id: 'bolo-laranja', categoria_id: 'bolos-caseiros', nome: 'Bolo de laranja', preco: 13 }),

  // --- Biscoitos ---
  item({
    id: 'biscoito-caseiro',
    categoria_id: 'biscoitos',
    nome: 'Biscoito caseiro',
    preco: 6,
    opcoes: [
      opcao('Cebolinha', 6),
      opcao('Bolinha de queijo', 6),
      opcao('Maracujá', 6),
      opcao('Palito de coco', 6),
      opcao('Lecinho de goiaba (a confirmar)', 6),
      opcao('Rosquinha de coco (a confirmar)', 6),
    ],
  }),

  // --- Águas ---
  item({
    id: 'agua-mineral-250',
    categoria_id: 'aguas',
    nome: 'Água mineral',
    preco: 3,
    opcoes: [opcao('Sem gás', 3, '250 ml'), opcao('Com gás', 3.5, '250 ml')],
  }),

  // --- Picolés e sorvetes ---
  item({
    id: 'picole',
    categoria_id: 'picoles',
    nome: 'Picolé',
    preco: 8,
    descricao: 'Escolha o sabor.',
    opcoes: [
      opcao('Sabor C… 1 (a confirmar)', 13.9),
      opcao('Sabor C… 2 (a confirmar)', 12.9),
      opcao('Sabor C… 3 (a confirmar)', 10),
      opcao('Sabor M… 1 (a confirmar)', 10),
      opcao('Sabor T… (a confirmar)', 10),
      opcao('Sabor D… (a confirmar)', 10),
      opcao('Sabor L… (a confirmar)', 10.5),
      opcao('Sabor M… 2 (a confirmar)', 9.5),
      opcao('Sabor C… 4 (a confirmar)', 9.5),
      opcao('Sabor P… (a confirmar)', 8.5),
      opcao('Sabor C… 5 (a confirmar)', 8.5),
      opcao('Sabor M… 3 (a confirmar)', 8),
      opcao('Sabor A… (a confirmar)', 8),
      opcao('Sabor C… 6 (a confirmar)', 10),
      opcao('Sabor Pi… (a confirmar)', 13.9),
    ],
  }),
  item({
    id: 'mini-sorvete',
    categoria_id: 'picoles',
    nome: 'Mini sorvete',
    preco: 16.9,
    descricao: 'Escolha o sabor.',
    opcoes: [
      opcao('Sabor 1 (a confirmar)', 19.9),
      opcao('Sabor 2 (a confirmar)', 19.9),
      opcao('Sabor 3 (a confirmar)', 16.9),
      opcao('Sabor 4 (a confirmar)', 19.9),
      opcao('Sabor 5 (a confirmar)', 22.9),
    ],
  }),

  // --- Doces ---
  item({ id: 'bolo-gelado', categoria_id: 'doces', nome: 'Bolo gelado', preco: 7 }),
  item({ id: 'copo-pequeno', categoria_id: 'doces', nome: 'Copo pequeno de mousse (a confirmar)', preco: 6 }),
  item({ id: 'marmita-cravejada', categoria_id: 'doces', nome: 'Marmita cravejada', preco: 20 }),
  item({
    id: 'morango-cravejado',
    categoria_id: 'doces',
    nome: 'Morango cravejado',
    preco: 14,
    opcoes: [opcao('Tradicional', 14), opcao('Maior (a confirmar)', 25)],
  }),

  // --- Polpas ---
  item({
    id: 'polpa-de-fruta',
    categoria_id: 'polpas',
    nome: 'Polpa de fruta',
    preco: 3,
    descricao: 'Polpa natural congelada. Escolha a fruta.',
    opcoes: [
      opcao('Açaí', 3.5),
      opcao('Acerola', 4),
      opcao('Cacau', 4),
      opcao('Cupuaçu', 3.5),
      opcao('Goiaba', 3),
      opcao('Graviola', 4),
      opcao('Jenipapo', 3),
      opcao('Manga', 3),
      opcao('Maracujá', 6),
      opcao('Siriguela', 4),
      opcao('Tamarindo', 3),
      opcao('Umbu', 3),
    ],
  }),
  item({
    id: 'polpa-de-fruta-1kg',
    categoria_id: 'polpas',
    nome: 'Polpa de fruta 1 kg',
    preco: 15,
    opcoes: [opcao('Manga', 15, '1 kg')],
  }),

  // --- Sobremesas ---
  item({ id: 'pudim-140', categoria_id: 'sobremesas', nome: 'Pudim 140 ml', preco: 8, descricao: 'O destaque da casa.' }),
  item({
    id: 'bolo-no-pote',
    categoria_id: 'sobremesas',
    nome: 'Bolo no pote',
    preco: 12,
    opcoes: [opcao('Opção 1 (a confirmar)', 12), opcao('Opção 2 (a confirmar)', 12)],
  }),
  item({
    id: 'munguza',
    categoria_id: 'sobremesas',
    nome: 'Munguzá',
    preco: 18,
    opcoes: [opcao('500 ml', 18), opcao('1 litro', 34)],
  }),

  // --- Licores ---
  item({
    id: 'licor-artesanal',
    categoria_id: 'licores',
    nome: 'Licor artesanal',
    preco: 40,
    opcoes: [
      opcao('Jenipapo', 40),
      opcao('Maracujá (a confirmar)', 40),
      opcao('Me… (a confirmar)', 40),
      opcao('Tamarindo (a confirmar)', 40),
    ],
  }),

  // --- Bomboniere ---
  item({ id: 'balas-sabores', categoria_id: 'bomboniere', nome: 'Balas (sabores)', preco: 0.25 }),
  item({ id: 'pirulito-chiclete', categoria_id: 'bomboniere', nome: 'Pirulito / chiclete', preco: 0.5 }),
  item({ id: 'danny-ball-tubo', categoria_id: 'bomboniere', nome: 'Danny Ball (tubo)', preco: 1 }),
  item({ id: 'gomets-tubo', categoria_id: 'bomboniere', nome: 'Gomets (tubo)', preco: 1.5 }),
  item({ id: 'fini-sabores', categoria_id: 'bomboniere', nome: 'Fini (sabores)', preco: 2 }),
  item({ id: 'salgadinhos', categoria_id: 'bomboniere', nome: 'Salgadinhos (a confirmar)', preco: 2 }),
  item({ id: 'halls-sabores', categoria_id: 'bomboniere', nome: 'Halls (sabores)', preco: 2.5 }),
  item({ id: 'pimentinha', categoria_id: 'bomboniere', nome: 'Pimentinha', preco: 3 }),
  item({ id: 'pipoca-doce-60g', categoria_id: 'bomboniere', nome: 'Pipoca doce 60 g', preco: 3 }),
  item({ id: 'pururuca-40g', categoria_id: 'bomboniere', nome: 'Pururuca 40 g', preco: 3 }),
  item({ id: 'cocada-recheada', categoria_id: 'bomboniere', nome: 'Cocada recheada', preco: 5 }),
];

export const cardapioLocal = {
  categorias: categoriasCardapio,
  marmitas: produtosCardapio,
};
