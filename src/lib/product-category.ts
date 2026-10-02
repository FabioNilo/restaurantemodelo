import {
  BadgePercent,
  CakeSlice,
  Candy,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  GlassWater,
  IceCreamCone,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Categoria, CategoriaListItem, MarmitaListItem } from '@/types/product';

type CategoryInput = Pick<Categoria, 'id' | 'nome'> | null | undefined;
type SortableCategory = Pick<CategoriaListItem, 'id' | 'nome' | 'ordem'>;

// Ordem padrão (a mesma do cardápio de delivery do Nosso Bistrô) para
// categorias sem "ordem" definida. Chaves já normalizadas (sem acento).
const DEFAULT_CATEGORY_ORDER: Record<string, number> = {
  'promocao-do-dia': 1,
  'promocao do dia': 1,
  tortas: 2,
  salgados: 3,
  cafes: 4,
  refrigerantes: 5,
  sucos: 6,
  'bolos-caseiros': 7,
  'bolos caseiros': 7,
  biscoitos: 8,
  aguas: 9,
  picoles: 10,
  doces: 11,
  polpas: 12,
  sobremesa: 13,
  sobremesas: 13,
  'linha-zero': 14,
  licor: 15,
  licores: 15,
  bomboniere: 16,
  paes: 17,
  mercearia: 18,
  bebidas: 19,
  bebida: 19,
};

// Ícone por categoria, usado no selo do card e na imagem de fallback.
// Casa por palavra-chave para funcionar também com categorias criadas no admin.
const CATEGORY_ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/promo/, BadgePercent],
  [/torta|bolo/, CakeSlice],
  [/salgad|lanche|misto|\bpao\b|paes/, Croissant],
  [/cafe|cappuc|capuc/, Coffee],
  [/refri|bebida|suco/, CupSoda],
  [/agua/, GlassWater],
  [/biscoit|cookie/, Cookie],
  [/picole|sorvete/, IceCreamCone],
  [/polpa|fruta/, Citrus],
  [/licor|vinho/, Wine],
  [/bombon|bala|doce/, Candy],
  [/sobremesa/, Dessert],
];

export function getCategoryIcon(category: CategoryInput): LucideIcon {
  const key = `${normalizeCategoryValue(category?.id)} ${normalizeCategoryValue(category?.nome)}`;
  return CATEGORY_ICON_RULES.find(([pattern]) => pattern.test(key))?.[1] ?? Utensils;
}

export function normalizeCategoryValue(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function isDessertCategory(category: CategoryInput) {
  const id = normalizeCategoryValue(category?.id);
  const name = normalizeCategoryValue(category?.nome);

  return id === 'sobremesa' || name === 'sobremesa';
}

export function isBeverageCategory(category: CategoryInput) {
  const id = normalizeCategoryValue(category?.id);
  const name = normalizeCategoryValue(category?.nome);

  return id === 'bebidas' || id === 'bebida' || name === 'bebidas' || name === 'bebida';
}

export function getDefaultCategoryOrder(category: CategoryInput) {
  const id = normalizeCategoryValue(category?.id);
  const name = normalizeCategoryValue(category?.nome);

  return DEFAULT_CATEGORY_ORDER[id] ?? DEFAULT_CATEGORY_ORDER[name] ?? null;
}

export function getCategoryDisplayOrder(category: SortableCategory) {
  return category.ordem !== null && category.ordem !== undefined && Number.isFinite(Number(category.ordem))
    ? Number(category.ordem)
    : getDefaultCategoryOrder(category) ?? 999;
}

export function sortCategoriesByDisplayOrder<T extends SortableCategory>(categories: T[]) {
  return [...categories].sort((a, b) => {
    const byOrder = getCategoryDisplayOrder(a) - getCategoryDisplayOrder(b);

    if (byOrder !== 0) {
      return byOrder;
    }

    const byDefault = (getDefaultCategoryOrder(a) ?? 999) - (getDefaultCategoryOrder(b) ?? 999);

    if (byDefault !== 0) {
      return byDefault;
    }

    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });
}

export function sortProductsByCategoryOrder<T extends Pick<MarmitaListItem, 'categoria_id' | 'nome' | 'id'>>(
  products: T[],
  categories: SortableCategory[]
) {
  const categoryOrderMap = new Map(
    sortCategoriesByDisplayOrder(categories).map((category, index) => [
      category.id,
      getCategoryDisplayOrder(category) * 1000 + index,
    ])
  );

  return [...products].sort((a, b) => {
    const byCategory = (categoryOrderMap.get(a.categoria_id ?? '') ?? 999999)
      - (categoryOrderMap.get(b.categoria_id ?? '') ?? 999999);

    if (byCategory !== 0) {
      return byCategory;
    }

    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true });
  });
}

export function getProductOptionLabels(category: CategoryInput) {
  if (isBeverageCategory(category)) {
    return {
      sectionTitle: 'Opções da bebida',
      sectionDescription: 'Sabores, embalagens ou volumes que o cliente escolhe no cardápio e no carrinho.',
      nameLabel: 'Opção',
      namePlaceholder: 'Lata',
      detailLabel: 'Detalhe (opcional)',
      detailPlaceholder: '350 ml',
      addLabel: 'Adicionar opção',
      emptySimpleTitle: 'Produto simples',
      emptySimpleDescription: 'Sem opções, o item usa apenas o preço principal.',
      invalidMessage: 'Preencha o nome e o preço de todas as opções.',
    };
  }

  return {
    sectionTitle: 'Opções / sabores',
    sectionDescription: 'Sabores, tamanhos ou variações que o cliente escolhe no cardápio e no carrinho.',
    nameLabel: 'Opção',
    namePlaceholder: 'Morango',
    detailLabel: 'Detalhe (opcional)',
    detailPlaceholder: '140 ml',
    addLabel: 'Adicionar opção',
    emptySimpleTitle: 'Produto simples',
    emptySimpleDescription: 'Sem opções, o item usa apenas o preço principal.',
    invalidMessage: 'Preencha o nome e o preço de todas as opções.',
  };
}

// Busca do cardápio: ignora acento e caixa, procura em nome, descrição e opções.
export function productMatchesSearch(
  product: Pick<MarmitaListItem, 'nome' | 'descricao' | 'tamanhos'>,
  query: string,
  categoryName?: string
) {
  const normalizedQuery = normalizeCategoryValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = normalizeCategoryValue(
    [product.nome, product.descricao, categoryName, ...(product.tamanhos ?? []).map((size) => size.nome)]
      .filter(Boolean)
      .join(' ')
  );

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}
