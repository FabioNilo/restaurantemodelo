import type { CategoriaListItem, MarmitaListItem, ProdutoTamanho } from '@/types/product';

// Cardápio do Nosso Bistrô Café, a partir da planilha do sistema de caixa
// (docs/produtos.xlsx, exportada em 02/10/2026). Os nomes foram normalizados
// (maiúsculas, acentos, abreviações como "C/", "LT", "UND"). O comentário
// "pdv:" de cada item lista os códigos da planilha que ele representa.
//
// - Itens com ATIVO = "Nao" entram como indisponíveis: não aparecem no site,
//   mas o dono liga no admin quando voltarem.
// - Quando o mesmo item aparece com dois preços, vale o código de delivery
//   (os "178319…", que batem com o PDF de delivery). As escolhas estão no
//   README, em "Pendências com o cliente".
// - Itens com vários sabores ou tamanhos viram um produto só, com as opções em
//   `tamanhos` (nome = sabor/tamanho, serve = detalhe opcional, preco). Em
//   produto ativo, só entram as opções ativas.
// - Ficaram de fora: a categoria "ARQUIVO MORTO" e os lançamentos internos de
//   caixa sem preço (cortesias, "Delivery grátis", descontos).
export const categoriasCardapio: CategoriaListItem[] = [
  { id: 'promocao-do-dia', nome: 'Promoção do dia', ordem: 1 },
  { id: 'tortas', nome: 'Tortas', ordem: 2 },
  { id: 'salgados', nome: 'Salgados', ordem: 3 },
  { id: 'cafes', nome: 'Cafés', ordem: 4 },
  { id: 'refrigerantes', nome: 'Refrigerantes', ordem: 5 },
  { id: 'sucos', nome: 'Sucos', ordem: 6 },
  { id: 'bolos-caseiros', nome: 'Bolos caseiros', ordem: 7 },
  { id: 'biscoitos', nome: 'Biscoitos', ordem: 8 },
  { id: 'aguas', nome: 'Águas', ordem: 9 },
  { id: 'picoles', nome: 'Picolés e sorvetes', ordem: 10 },
  { id: 'doces', nome: 'Doces', ordem: 11 },
  { id: 'polpas', nome: 'Polpas', ordem: 12 },
  { id: 'sobremesas', nome: 'Sobremesas', ordem: 13 },
  { id: 'linha-zero', nome: 'Linha zero (açúcar, lactose e glúten)', ordem: 14 },
  { id: 'licores', nome: 'Licores', ordem: 15 },
  { id: 'bomboniere', nome: 'Bomboniere', ordem: 16 },
  { id: 'paes', nome: 'Pães', ordem: 17 },
  { id: 'mercearia', nome: 'Mercearia', ordem: 18 },
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
  item({ id: 'promo-2-fatias-30', categoria_id: 'promocao-do-dia', nome: '2 fatias de torta por R$ 30', preco: 30, descricao: 'Duas fatias de torta à sua escolha.' }), // pdv: 977768
  item({ id: 'promo-2-fatias-25', categoria_id: 'promocao-do-dia', nome: '2 fatias de torta por R$ 25', preco: 25, descricao: 'Duas fatias de torta à sua escolha.' }), // pdv: 165470, 124860, 869325
  item({ id: 'promo-salgado', categoria_id: 'promocao-do-dia', nome: '3 salgados por R$ 10', preco: 10 }), // pdv: 132286
  item({ id: 'promo-torta', categoria_id: 'promocao-do-dia', nome: 'Torta promoção', preco: 14 }), // pdv: 997342, 801538, 657258
  item({ id: 'promo-combo-light', categoria_id: 'promocao-do-dia', nome: 'Combo light', preco: 16.9 }), // pdv: 579811
  item({ id: 'promo-combo-2-fatias-retirada', categoria_id: 'promocao-do-dia', nome: 'Combo 2 fatias de torta (retirada)', preco: 30, disponivel: false }), // pdv: 859676
  item({ id: 'promo-combo-2-fatias-delivery', categoria_id: 'promocao-do-dia', nome: 'Combo 2 fatias de torta (delivery)', preco: 35, disponivel: false }), // pdv: 1783190915
  item({ id: 'promo-combo-bolo', categoria_id: 'promocao-do-dia', nome: 'Combo bolo', preco: 19.9, disponivel: false }), // pdv: 648674
  item({ id: 'promo-combo-salgados', categoria_id: 'promocao-do-dia', nome: 'Combo salgados', preco: 30, disponivel: false }), // pdv: 649093
  item({ id: 'promo-3-salgados-assados', categoria_id: 'promocao-do-dia', nome: '3 salgados assados (combo)', preco: 5, disponivel: false }), // pdv: 612187
  item({ id: 'promo-3-paes', categoria_id: 'promocao-do-dia', nome: '3 pães (promoção)', preco: 1, disponivel: false }), // pdv: 077842
  item({
    id: 'promo-cafes',
    categoria_id: 'promocao-do-dia',
    nome: 'Cafés em promoção',
    preco: 2,
    disponivel: false,
    opcoes: [
      opcao('Expresso', 2), // pdv: 1779541909
      opcao('Expresso curto', 2), // pdv: 1779541954
      opcao('Expresso duplo', 3), // pdv: 1779541996
      opcao('Americano', 2), // pdv: 1779542134
      opcao('Cappuccino', 5), // pdv: 1779542230
      opcao('Café com leite', 3.5), // pdv: 1779542274
      opcao('Cappuccino Alpino', 5.5), // pdv: 1779542325
      opcao('Dois Frades', 4.5), // pdv: 1779542376
      opcao('Mocha Dois Frades', 5), // pdv: 1779545091
    ],
  }),

  // --- Tortas ---
  item({ id: 'fatia-olho-de-sogra', categoria_id: 'tortas', nome: 'Fatia de torta olho de sogra', preco: 17 }), // pdv: 908894
  item({ id: 'fatia-ninho-morango-geleia', categoria_id: 'tortas', nome: 'Fatia de Ninho com morango e geleia', preco: 17 }), // pdv: 18, 751443
  item({ id: 'fatia-costelinha-barbecue', categoria_id: 'tortas', nome: 'Fatia de costelinha com barbecue', preco: 17 }), // pdv: 24
  item({ id: 'fatia-ferrero-rocher', categoria_id: 'tortas', nome: 'Fatia de Ferrero Rocher', preco: 17, disponivel: false }), // pdv: 501226, 1783189482
  item({ id: 'fatia-ninho-nutella', categoria_id: 'tortas', nome: 'Fatia de Ninho com Nutella', preco: 17, disponivel: false }), // pdv: 948678, 1783189615
  item({ id: 'fatia-pudim', categoria_id: 'tortas', nome: 'Fatia de pudim', preco: 15, disponivel: false }), // pdv: 1783189546, 15
  item({ id: 'fatia-matilda', categoria_id: 'tortas', nome: 'Fatia Matilda', preco: 10, disponivel: false }), // pdv: 1783189701, 14
  item({ id: 'fatia-camarao-cream-cheese', categoria_id: 'tortas', nome: 'Fatia de camarão com cream cheese', preco: 20, disponivel: false }), // pdv: 1783189786, 23
  item({ id: 'fatia-surpresa-de-uva', categoria_id: 'tortas', nome: 'Fatia surpresa de uva', preco: 15, disponivel: false }), // pdv: 909102
  item({ id: 'fatia-ninho-chocolate', categoria_id: 'tortas', nome: 'Fatia de Ninho com chocolate', preco: 15, disponivel: false }), // pdv: 225795
  item({ id: 'fatia-maracuja-chocolate', categoria_id: 'tortas', nome: 'Fatia de maracujá com chocolate', preco: 17, disponivel: false }), // pdv: 462903
  item({ id: 'fatia-coco-abacaxi', categoria_id: 'tortas', nome: 'Fatia de coco com abacaxi', preco: 17, disponivel: false }), // pdv: 730590, 20
  item({ id: 'fatia-red-velvet', categoria_id: 'tortas', nome: 'Fatia red velvet', preco: 17, disponivel: false }), // pdv: 249032
  item({ id: 'mini-vulcao', categoria_id: 'tortas', nome: 'Mini vulcão', preco: 14, disponivel: false }), // pdv: 291262
  item({ id: 'fatia-morango-geleia-chocolate', categoria_id: 'tortas', nome: 'Fatia de morango com geleia e chocolate', preco: 17, disponivel: false }), // pdv: 16
  item({ id: 'fatia-ameixa-coco-doce-de-leite', categoria_id: 'tortas', nome: 'Fatia de ameixa com coco e doce de leite', preco: 17, disponivel: false }), // pdv: 17
  item({ id: 'fatia-chocolatuda', categoria_id: 'tortas', nome: 'Fatia chocolatuda', preco: 17, disponivel: false }), // pdv: 19
  item({ id: 'fatia-pistache-morango', categoria_id: 'tortas', nome: 'Fatia de pistache com morango', preco: 22, disponivel: false }), // pdv: 21
  item({ id: 'fatia-limao', categoria_id: 'tortas', nome: 'Fatia de limão', preco: 17, disponivel: false }), // pdv: 22
  item({
    id: 'bolo-no-pote-p',
    categoria_id: 'tortas',
    nome: 'Bolo no pote pequeno',
    preco: 8,
    disponivel: false,
    opcoes: [opcao('Limão siciliano com frutas vermelhas', 8, 'Tamanho P')], // pdv: 896305, 682375
  }),

  // --- Salgados ---
  item({ id: 'salgado-medio', categoria_id: 'salgados', nome: 'Salgado médio', preco: 4 }), // pdv: 897218
  item({ id: 'salgado-assado', categoria_id: 'salgados', nome: 'Salgado assado', preco: 2.5 }), // pdv: 168940
  item({ id: 'misto-quente', categoria_id: 'salgados', nome: 'Misto quente (queijo e presunto)', preco: 6 }), // pdv: 195330
  item({ id: 'misto-quente-com', categoria_id: 'salgados', nome: 'Misto quente com ovo', preco: 8 }), // pdv: 195374
  item({ id: 'coxinha-frango-requeijao', categoria_id: 'salgados', nome: 'Coxinha de frango com requeijão', preco: 10 }), // pdv: 7898061710029
  item({ id: 'croissant', categoria_id: 'salgados', nome: 'Croissant', preco: 10 }), // pdv: 7898061714041
  item({ id: 'mini-pao-de-queijo', categoria_id: 'salgados', nome: 'Mini pão de queijo (6 unidades)', preco: 12 }), // pdv: 7898061712153
  item({
    id: 'quiche',
    categoria_id: 'salgados',
    nome: 'Quiche',
    preco: 10,
    disponivel: false,
    opcoes: [
      opcao('Bacalhau', 10), // pdv: 238677
      opcao('Camarão', 10), // pdv: 735289
      opcao('Carne seca com banana', 10), // pdv: 736901
      opcao('Costelinha com barbecue e cebola caramelizada', 10), // pdv: 736937
      opcao('Costela bovina com cream cheese', 10), // pdv: 113744
      opcao('Quatro queijos', 10), // pdv: 535309
      opcao('Bacon com cream cheese', 10), // pdv: 322891
    ],
  }),
  item({
    id: 'empada',
    categoria_id: 'salgados',
    nome: 'Empada',
    preco: 9,
    disponivel: false,
    opcoes: [
      opcao('Frango com cream cheese', 9), // pdv: 534556
      opcao('Costelinha com barbecue e cebola caramelizada', 9), // pdv: 535169
    ],
  }),
  item({
    id: 'esfirra',
    categoria_id: 'salgados',
    nome: 'Esfirra',
    preco: 10,
    disponivel: false,
    opcoes: [opcao('Carne', 10), opcao('Frango', 10)], // pdv: 377103, 377155
  }),
  item({
    id: 'pizza-brotinho',
    categoria_id: 'salgados',
    nome: 'Pizza brotinho',
    preco: 10,
    disponivel: false,
    opcoes: [opcao('Calabresa', 10), opcao('Frango', 10), opcao('Mista', 10)], // pdv: 7898061710968, 7898061710951, 7898061710944
  }),
  item({
    id: 'folhado',
    categoria_id: 'salgados',
    nome: 'Folhado',
    preco: 10,
    disponivel: false,
    opcoes: [opcao('Frango com requeijão', 10), opcao('Banana com canela', 10)], // pdv: 7898061711873, 7898061712979
  }),
  item({
    id: 'pastel-da-vovo',
    categoria_id: 'salgados',
    nome: 'Pastel da vovó',
    preco: 10,
    disponivel: false,
    opcoes: [opcao('Calabresa', 10), opcao('Integral de peito de peru', 10)], // pdv: 7898061712306, 7898061712344
  }),
  item({ id: 'pao-delicia', categoria_id: 'salgados', nome: 'Pão delícia', preco: 10, disponivel: false }), // pdv: 053693
  item({ id: 'pizza-fechada', categoria_id: 'salgados', nome: 'Pizza fechada', preco: 9, disponivel: false }), // pdv: 293760
  item({ id: 'brioche-queijo-presunto', categoria_id: 'salgados', nome: 'Brioche de queijo e presunto', preco: 9, disponivel: false }), // pdv: 534577
  item({ id: 'lombinho-cream-cheese', categoria_id: 'salgados', nome: 'Lombinho com cream cheese', preco: 10, disponivel: false }), // pdv: 535262
  item({ id: 'enroladinho-peito-de-peru', categoria_id: 'salgados', nome: 'Enroladinho de peito de peru com cream cheese', preco: 10, disponivel: false }), // pdv: 322926
  item({ id: 'enroladinho-calabresa', categoria_id: 'salgados', nome: 'Enroladinho de calabresa', preco: 10, disponivel: false }), // pdv: 377175
  item({ id: 'bauru', categoria_id: 'salgados', nome: 'Bauru', preco: 10, disponivel: false }), // pdv: 376946
  item({ id: 'pastel-lombinho-amora', categoria_id: 'salgados', nome: 'Pastel de lombinho com geleia de amora', preco: 10, disponivel: false }), // pdv: 377004
  item({ id: 'pastel-costela', categoria_id: 'salgados', nome: 'Pastel de costela', preco: 10, disponivel: false }), // pdv: 377058
  item({ id: 'pastel-forno-frango', categoria_id: 'salgados', nome: 'Pastel de forno de frango', preco: 10, disponivel: false }), // pdv: 7898061712184
  item({ id: 'chimango', categoria_id: 'salgados', nome: 'Chimango (3 unidades)', preco: 12, disponivel: false }), // pdv: 7898061712931
  item({ id: 'salgados-pequenos', categoria_id: 'salgados', nome: 'Salgado pequeno', preco: 2.5, disponivel: false }), // pdv: 579397
  item({ id: 'salgado-frito', categoria_id: 'salgados', nome: 'Salgado frito', preco: 4, disponivel: false }), // pdv: 132272
  item({ id: 'coxinha', categoria_id: 'salgados', nome: 'Coxinha', preco: 4, disponivel: false }), // pdv: 132175
  item({ id: 'pastel-frango', categoria_id: 'salgados', nome: 'Pastel de frango', preco: 4, disponivel: false }), // pdv: 199116
  item({ id: 'banana-real', categoria_id: 'salgados', nome: 'Banana real', preco: 4, disponivel: false }), // pdv: 132130

  // --- Cafés ---
  item({ id: 'expresso', categoria_id: 'cafes', nome: 'Expresso', preco: 4 }), // pdv: 1
  item({ id: 'expresso-duplo', categoria_id: 'cafes', nome: 'Expresso duplo', preco: 6 }), // pdv: 3
  item({ id: 'expresso-especial', categoria_id: 'cafes', nome: 'Expresso especial da casa', preco: 6.5 }), // pdv: 809248, 809018
  item({ id: 'americano', categoria_id: 'cafes', nome: 'Americano', preco: 4 }), // pdv: 4
  item({ id: 'cafe-com-leite', categoria_id: 'cafes', nome: 'Café com leite', preco: 9 }), // pdv: 6
  item({ id: 'cafe-com-leite-curto', categoria_id: 'cafes', nome: 'Café com leite curto', preco: 7 }), // pdv: 7
  item({ id: 'cappuccino', categoria_id: 'cafes', nome: 'Cappuccino', preco: 11 }), // pdv: 1783190365, 5
  item({ id: 'cappuccino-alpino', categoria_id: 'cafes', nome: 'Cappuccino Alpino', preco: 12 }), // pdv: 1783190738, 10
  item({ id: 'cappuccino-kitkat', categoria_id: 'cafes', nome: 'KitKat', preco: 11 }), // pdv: 1783190638, 9
  item({ id: 'alpino', categoria_id: 'cafes', nome: 'Alpino', preco: 10 }), // pdv: 11
  item({ id: 'mocha-dois-frades', categoria_id: 'cafes', nome: 'Mocha Dois Frades', preco: 11, descricao: 'Com chocolate Dois Frades.' }), // pdv: 1783190798, 12
  item({ id: 'dois-frades', categoria_id: 'cafes', nome: 'Dois Frades', preco: 10, descricao: 'Com chocolate Dois Frades.' }), // pdv: 13
  item({ id: 'cafe-melitta', categoria_id: 'cafes', nome: 'Melitta tradicional', preco: 16.5 }), // pdv: 1789592262
  item({ id: 'expresso-curto', categoria_id: 'cafes', nome: 'Expresso curto', preco: 4, disponivel: false }), // pdv: 2

  // --- Refrigerantes ---
  item({
    id: 'coca-cola-original',
    categoria_id: 'refrigerantes',
    nome: 'Coca-Cola',
    preco: 5,
    opcoes: [
      opcao('KS', 5, '290 ml'), // pdv: 241744
      opcao('Lata', 6, '350 ml'), // pdv: 7894900010015
      opcao('Zero lata', 6, '350 ml'), // pdv: 7894900700015, 1783190064
      opcao('Garrafa 1 L', 10), // pdv: 1783190179, 7894900027044
    ],
  }),
  item({
    id: 'guarana-antarctica',
    categoria_id: 'refrigerantes',
    nome: 'Guaraná Antarctica',
    preco: 6,
    opcoes: [opcao('Tradicional', 6), opcao('Zero', 6)], // pdv: 146092, 146046
  }),
  item({
    id: 'fys',
    categoria_id: 'refrigerantes',
    nome: 'Fys',
    preco: 6,
    opcoes: [opcao('Limão siciliano', 6), opcao('Laranja-pera', 6)], // pdv: 146108, 146168
  }),
  item({
    id: 'schweppes',
    categoria_id: 'refrigerantes',
    nome: 'Schweppes',
    preco: 7,
    opcoes: [
      opcao('Tônica', 7, '350 ml'), // pdv: 1783190003, 097781
      opcao('Citrus', 7, '350 ml'), // pdv: 1783190138, 7894900320015
    ],
  }),
  item({ id: 'sprite-lata', categoria_id: 'refrigerantes', nome: 'Sprite lata 350 ml', preco: 6 }), // pdv: 7894900681017
  item({ id: 'kuat-lata', categoria_id: 'refrigerantes', nome: 'Kuat lata 350 ml', preco: 6 }), // pdv: 7894900910018
  item({ id: 'frutyba', categoria_id: 'refrigerantes', nome: 'Frutyba', preco: 3 }), // pdv: 331801
  item({ id: 'leao-ice-tea-pessego', categoria_id: 'refrigerantes', nome: 'Leão Ice Tea pêssego 1 L', preco: 12, disponivel: false }), // pdv: 7891098040992

  // --- Sucos ---
  item({
    id: 'suco',
    categoria_id: 'sucos',
    nome: 'Suco de fruta',
    preco: 8,
    descricao: 'Escolha a fruta.',
    opcoes: [
      opcao('Acerola', 8), // pdv: 44
      opcao('Cacau', 8), // pdv: 46
      opcao('Cupuaçu', 8), // pdv: 43
      opcao('Goiaba', 8), // pdv: 39
      opcao('Graviola', 8), // pdv: 45
      opcao('Jenipapo', 8), // pdv: 40
      opcao('Manga', 8), // pdv: 38
      opcao('Maracujá', 8), // pdv: 47
      opcao('Tamarindo', 8), // pdv: 41
      opcao('Umbu', 8), // pdv: 42
    ],
  }),
  item({ id: 'suco-maracuja-cupuacu', categoria_id: 'sucos', nome: 'Suco de maracujá com cupuaçu', preco: 10, disponivel: false }), // pdv: 48

  // --- Bolos caseiros ---
  item({ id: 'bolo-de-cenoura', categoria_id: 'bolos-caseiros', nome: 'Bolo de cenoura', preco: 20 }), // pdv: 076998
  item({ id: 'bolo-milho', categoria_id: 'bolos-caseiros', nome: 'Bolo de milho', preco: 22 }), // pdv: 232702
  item({ id: 'bolo-aipim', categoria_id: 'bolos-caseiros', nome: 'Bolo de aipim', preco: 22 }), // pdv: 232746
  item({ id: 'bolo-caseiro-com', categoria_id: 'bolos-caseiros', nome: 'Bolo caseiro com cobertura', preco: 25 }), // pdv: 081560
  item({ id: 'bolo-queijo-goiabada', categoria_id: 'bolos-caseiros', nome: 'Bolo de queijo com goiabada', preco: 15 }), // pdv: 27
  item({ id: 'bolo-maracuja', categoria_id: 'bolos-caseiros', nome: 'Bolo de maracujá', preco: 13 }), // pdv: 28
  item({ id: 'bolo-mesclado', categoria_id: 'bolos-caseiros', nome: 'Bolo mesclado', preco: 13 }), // pdv: 25
  item({ id: 'bolo-laranja', categoria_id: 'bolos-caseiros', nome: 'Bolo de laranja', preco: 13 }), // pdv: 29
  item({ id: 'bolo-manteiga-200g', categoria_id: 'bolos-caseiros', nome: 'Bolo de manteiga 200 g', preco: 13 }), // pdv: 711203
  item({ id: 'bolo-puba-fatia', categoria_id: 'bolos-caseiros', nome: 'Bolo de puba (fatia)', preco: 10 }), // pdv: 414014
  item({ id: 'mini-bolo-limao-siciliano', categoria_id: 'bolos-caseiros', nome: 'Mini bolo de limão siciliano com geleia de frutas vermelhas', preco: 17 }), // pdv: 1789592310
  item({ id: 'mini-bolo-matilda', categoria_id: 'bolos-caseiros', nome: 'Mini bolo Matilda', preco: 17 }), // pdv: 1789592372
  item({ id: 'bolo-coco', categoria_id: 'bolos-caseiros', nome: 'Bolo de coco', preco: 15, disponivel: false }), // pdv: 076912
  item({ id: 'bolo-coco-abacaxi', categoria_id: 'bolos-caseiros', nome: 'Bolo de coco com abacaxi', preco: 13, disponivel: false }), // pdv: 076974
  item({ id: 'bolo-coco-goiabada', categoria_id: 'bolos-caseiros', nome: 'Bolo de coco com goiabada', preco: 15, disponivel: false }), // pdv: 232717
  item({ id: 'bolo-tradicional', categoria_id: 'bolos-caseiros', nome: 'Bolo tradicional', preco: 15, disponivel: false }), // pdv: 232757
  item({ id: 'bolo-caseiro-promocao', categoria_id: 'bolos-caseiros', nome: 'Bolo caseiro (promoção)', preco: 10, disponivel: false }), // pdv: 080980
  item({ id: 'bolo-aipim-promocao', categoria_id: 'bolos-caseiros', nome: 'Bolo de aipim (promoção)', preco: 18, disponivel: false }), // pdv: 30
  item({ id: 'fatia-bolo-caseiro', categoria_id: 'bolos-caseiros', nome: 'Fatia de bolo caseiro', preco: 5, disponivel: false }), // pdv: 773381
  item({ id: 'fatia-bolo-iogurte', categoria_id: 'bolos-caseiros', nome: 'Fatia de bolo de iogurte', preco: 4, disponivel: false }), // pdv: 294895
  item({ id: 'canjica-500ml', categoria_id: 'bolos-caseiros', nome: 'Canjica de milho 500 ml', preco: 15, disponivel: false }), // pdv: 067325

  // --- Biscoitos ---
  item({
    id: 'biscoito-caseiro',
    categoria_id: 'biscoitos',
    nome: 'Biscoito caseiro',
    preco: 6,
    opcoes: [
      opcao('Cebolinha', 6), // pdv: 49
      opcao('Bolinha de queijo', 6), // pdv: 50
      opcao('Maracujá', 6), // pdv: 51
      opcao('Palito de coco', 6), // pdv: 52
      opcao('Lencinho de goiabada', 6), // pdv: 53
      opcao('Rosquinha de coco', 6), // pdv: 54
    ],
  }),

  // --- Águas ---
  item({
    id: 'agua-mineral-250',
    categoria_id: 'aguas',
    nome: 'Água mineral',
    preco: 3,
    opcoes: [
      opcao('Sem gás', 3, '250 ml'), // pdv: 58
      opcao('Com gás', 3.5, '250 ml'), // pdv: 59
    ],
  }),

  // --- Picolés e sorvetes ---
  item({
    id: 'picole',
    categoria_id: 'picoles',
    nome: 'Picolé',
    preco: 8,
    descricao: 'Escolha o sabor.',
    opcoes: [
      opcao('Açaí', 8), // pdv: 751320387639
      opcao('Morango', 8), // pdv: 751320387653
      opcao('Coco', 8.5), // pdv: 736532020475
      opcao('Paçoca', 8.5), // pdv: 736532020499
      opcao('Chocolate zero açúcar', 9.5), // pdv: 618231117888
      opcao('Mousse de maracujá', 9.5), // pdv: 618231117864
      opcao('Chocolate belga com brigadeiro', 10), // pdv: 751320387622
      opcao('Chocomaltine', 10), // pdv: 74468489097
      opcao('Doce de leite', 10), // pdv: 736532020482
      opcao('Morango com leite condensado', 10), // pdv: 751320387615
      opcao('Torta de limão', 10), // pdv: 736532020468
      opcao('Leite com creme de avelã', 10.5), // pdv: 618231117895
      opcao('Clássico (Skimo)', 12.9), // pdv: 618231117901
      opcao('Cookies and cream', 13.9), // pdv: 618231117871
      opcao('Pistache', 13.9), // pdv: 74468489080
    ],
  }),
  item({
    id: 'mini-sorvete',
    categoria_id: 'picoles',
    nome: 'Mini sorvete',
    preco: 16.9,
    descricao: 'Escolha o sabor.',
    opcoes: [
      opcao('Coco', 16.9), // pdv: 74468978416
      opcao('Cheesecake de morango', 19.9), // pdv: 74468978393
      opcao('Chocolate belga com brigadeiro', 19.9), // pdv: 74468978409
      opcao('Doce de leite', 19.9), // pdv: 74468978423
      opcao('Pistache', 22.9), // pdv: 74468978430
    ],
  }),

  // --- Doces ---
  item({ id: 'bolo-gelado', categoria_id: 'doces', nome: 'Bolo gelado', preco: 7 }), // pdv: 879151
  item({ id: 'brigadeiro', categoria_id: 'doces', nome: 'Brigadeiro', preco: 2.5 }), // pdv: 462834
  item({ id: 'alfajor', categoria_id: 'doces', nome: 'Alfajor (unidade)', preco: 6 }), // pdv: 102540
  item({
    id: 'morango-cravejado',
    categoria_id: 'doces',
    nome: 'Morango cravejado',
    preco: 14,
    opcoes: [
      opcao('Tradicional', 14), // pdv: 613003
      opcao('Maior (a confirmar)', 25), // pdv: 613037
    ],
  }),
  item({ id: 'copo-pequeno', categoria_id: 'doces', nome: 'Copo pequeno de morango cravejado', preco: 6 }), // pdv: 808905
  item({ id: 'marmita-cravejada', categoria_id: 'doces', nome: 'Marmita cravejada', preco: 20 }), // pdv: 808804
  item({ id: 'ferrero-rocher', categoria_id: 'doces', nome: 'Ferrero Rocher', preco: 5, disponivel: false }), // pdv: 33
  item({ id: 'churros', categoria_id: 'doces', nome: 'Churros', preco: 5, disponivel: false }), // pdv: 35

  // --- Polpas ---
  item({
    id: 'polpa-de-fruta',
    categoria_id: 'polpas',
    nome: 'Polpa de fruta',
    preco: 3,
    descricao: 'Polpa natural congelada. Escolha a fruta.',
    opcoes: [
      opcao('Açaí', 3.5), // pdv: 545713
      opcao('Acerola', 4), // pdv: 545635
      opcao('Cacau', 4), // pdv: 545671
      opcao('Cupuaçu', 3.5), // pdv: 545620
      opcao('Goiaba', 3), // pdv: 545531
      opcao('Graviola', 4), // pdv: 545652
      opcao('Jenipapo', 3), // pdv: 545554
      opcao('Manga', 3), // pdv: 545466
      opcao('Maracujá', 6), // pdv: 545690
      opcao('Siriguela', 4), // pdv: 473799
      opcao('Tamarindo', 3), // pdv: 545573
      opcao('Umbu', 3), // pdv: 545598
    ],
  }),
  item({ id: 'polpa-de-fruta-1kg', categoria_id: 'polpas', nome: 'Polpa de fruta 1 kg', preco: 15 }), // pdv: 109449

  // --- Sobremesas ---
  item({ id: 'pudim-140', categoria_id: 'sobremesas', nome: 'Pudim 140 ml', preco: 8, descricao: 'O destaque da casa.' }), // pdv: 126808
  item({
    id: 'bolo-no-pote',
    categoria_id: 'sobremesas',
    nome: 'Bolo no pote',
    preco: 12,
    opcoes: [
      opcao('Ninho com geleia de morango', 12, 'Tamanho M'), // pdv: 249097
      opcao('Maracujá com chocolate', 12, 'Tamanho M'), // pdv: 249144
    ],
  }),
  item({
    id: 'munguza',
    categoria_id: 'sobremesas',
    nome: 'Munguzá',
    preco: 18,
    opcoes: [opcao('500 ml', 18), opcao('1 litro', 34)], // pdv: 232833, 232909
  }),
  item({ id: 'mousse-maracuja', categoria_id: 'sobremesas', nome: 'Mousse de maracujá', preco: 8.3, disponivel: false }), // pdv: 331432
  item({ id: 'torta-mousse-chocolate', categoria_id: 'sobremesas', nome: 'Torta mousse de chocolate', preco: 15, disponivel: false }), // pdv: 510832

  // --- Linha zero (açúcar, lactose e glúten) ---
  item({
    id: 'zero-bolo-caseiro',
    categoria_id: 'linha-zero',
    nome: 'Bolo caseiro zero açúcar',
    preco: 27,
    disponivel: false,
    opcoes: [opcao('Milho', 27), opcao('Maracujá', 27), opcao('Coco', 27)], // pdv: 548867, 548947, 548982
  }),
  item({
    id: 'zero-bolo-no-pote',
    categoria_id: 'linha-zero',
    nome: 'Bolo no pote zero açúcar',
    preco: 18,
    disponivel: false,
    opcoes: [
      opcao('Maracujá', 18), // pdv: 549449
      opcao('Chocolate com pudim', 18), // pdv: 549517
      opcao('Ameixa (zero lactose)', 18), // pdv: 549574
      opcao('Chocolate', 18), // pdv: 804181
      opcao('Doce de leite', 18), // pdv: 804288
    ],
  }),
  item({
    id: 'zero-biscoito',
    categoria_id: 'linha-zero',
    nome: 'Biscoito zero lactose e zero glúten',
    preco: 12,
    disponivel: false,
    opcoes: [opcao('Queijo', 12), opcao('Cebola', 12), opcao('Alho', 12)], // pdv: 549165, 549210, 549248
  }),
  item({
    id: 'zero-alfajor',
    categoria_id: 'linha-zero',
    nome: 'Alfajor zero açúcar',
    preco: 21,
    disponivel: false,
    opcoes: [opcao('Chocolate', 21), opcao('Chocolate branco', 21)], // pdv: 549361, 549323
  }),
  item({ id: 'zero-biscoito-carequinha', categoria_id: 'linha-zero', nome: 'Biscoito carequinha', preco: 12, disponivel: false }), // pdv: 549291
  item({ id: 'zero-palha-italiana', categoria_id: 'linha-zero', nome: 'Palha italiana zero açúcar', preco: 21, disponivel: false }), // pdv: 549015
  item({ id: 'zero-broa-de-milho', categoria_id: 'linha-zero', nome: 'Broa de milho zero açúcar', preco: 13, disponivel: false }), // pdv: 549063
  item({ id: 'zero-lencinho-goiabada', categoria_id: 'linha-zero', nome: 'Lencinho de goiabada zero açúcar', preco: 15, disponivel: false }), // pdv: 549115
  item({ id: 'zero-docinhos', categoria_id: 'linha-zero', nome: 'Docinhos zero açúcar e zero lactose', preco: 4, disponivel: false }), // pdv: 549395
  item({ id: 'zero-rocambole-goiabada', categoria_id: 'linha-zero', nome: 'Rocambole de goiabada', preco: 12, disponivel: false }), // pdv: 508898

  // --- Licores ---
  item({
    id: 'licor-artesanal',
    categoria_id: 'licores',
    nome: 'Licor artesanal',
    preco: 40,
    opcoes: [
      opcao('Jenipapo', 40), // pdv: 905969
      opcao('Maracujá', 40), // pdv: 906017
      opcao('Mel de cacau', 40), // pdv: 905894
      opcao('Tamarindo', 40), // pdv: 905945
    ],
  }),

  // --- Bomboniere ---
  item({ id: 'balas-sabores', categoria_id: 'bomboniere', nome: 'Bala (vários sabores)', preco: 0.25 }), // pdv: 114137
  item({ id: 'pirulito-chiclete', categoria_id: 'bomboniere', nome: 'Pirulito ou chiclete', preco: 0.5 }), // pdv: 114284
  item({ id: 'danny-ball-tubo', categoria_id: 'bomboniere', nome: 'Danny Ball (tubo)', preco: 1 }), // pdv: 114212
  item({ id: 'gomets-tubo', categoria_id: 'bomboniere', nome: 'Gomets (tubo)', preco: 1.5 }), // pdv: 114019
  item({ id: 'fini-sabores', categoria_id: 'bomboniere', nome: 'Fini (vários sabores)', preco: 2 }), // pdv: 114065
  item({ id: 'pacoca-cobertura', categoria_id: 'bomboniere', nome: 'Paçoca com cobertura', preco: 2 }), // pdv: 726494
  item({ id: 'salgadinhos', categoria_id: 'bomboniere', nome: 'Salgadinho 33 g (vários sabores)', preco: 2 }), // pdv: 446902
  item({ id: 'bala-de-cafe', categoria_id: 'bomboniere', nome: 'Bala de café', preco: 2.5 }), // pdv: 909299
  item({ id: 'halls-sabores', categoria_id: 'bomboniere', nome: 'Halls (vários sabores)', preco: 2.5 }), // pdv: 113959
  item({ id: 'trident', categoria_id: 'bomboniere', nome: 'Trident (vários sabores)', preco: 3 }), // pdv: 801724
  item({ id: 'pimentinha', categoria_id: 'bomboniere', nome: 'Pimentinha', preco: 3 }), // pdv: 446863
  item({ id: 'pipoca-doce-60g', categoria_id: 'bomboniere', nome: 'Pipoca doce 60 g', preco: 3 }), // pdv: 446807
  item({ id: 'pururuca-40g', categoria_id: 'bomboniere', nome: 'Pururuca 40 g', preco: 3 }), // pdv: 446747
  item({
    id: 'cocada-recheada',
    categoria_id: 'bomboniere',
    nome: 'Cocada recheada',
    preco: 5,
    opcoes: [opcao('Leite', 5), opcao('Maracujá', 5), opcao('Café', 5)], // pdv: 55, 56, 57
  }),

  // --- Pães ---
  item({
    id: 'pao',
    categoria_id: 'paes',
    nome: 'Pão (unidade)',
    preco: 0.5,
    opcoes: [opcao('Sal', 0.5), opcao('Leite', 0.5), opcao('Milho', 0.5)], // pdv: 077742
  }),
  item({ id: 'pao-de-queijo', categoria_id: 'paes', nome: 'Pão de queijo (unidade)', preco: 0.55 }), // pdv: 1787317874, 1787317803

  // --- Mercearia ---
  item({ id: 'manteiga-pau-brasil', categoria_id: 'mercearia', nome: 'Manteiga Pau Brasil 250 g', preco: 17.5 }), // pdv: 792451
  item({ id: 'leite-itambe', categoria_id: 'mercearia', nome: 'Leite Itambé 1 L', preco: 9 }), // pdv: 792554
];

export const cardapioLocal = {
  categorias: categoriasCardapio,
  marmitas: produtosCardapio,
};
