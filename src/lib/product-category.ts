import type { Categoria, CategoriaListItem, MarmitaListItem } from '@/types/product';

type CategoryInput = Pick<Categoria, 'id' | 'nome'> | null | undefined;
type SortableCategory = Pick<CategoriaListItem, 'id' | 'nome' | 'ordem'>;

const DEFAULT_CATEGORY_ORDER: Record<string, number> = {
  risottos: 1,
  risotto: 1,
  tagliatelle: 2,
  talharim: 2,
  gnocchi: 3,
  nhoque: 3,
  sobremesa: 4,
  sobremesas: 4,
  bebidas: 5,
  bebida: 5,
};

function normalizeCategoryValue(value: string | null | undefined) {
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
      sectionTitle: 'Volumes da bebida',
      sectionDescription: 'Configure as embalagens e volumes que aparecem no cardápio e no carrinho.',
      nameLabel: 'Embalagem',
      namePlaceholder: 'Lata',
      detailLabel: 'Volume',
      detailPlaceholder: '350 ml',
      addLabel: 'Adicionar volume',
      emptySimpleTitle: 'Produto simples',
      emptySimpleDescription: 'Bebidas podem usar apenas o preço principal ou ter volumes configuráveis.',
      invalidMessage: 'Preencha embalagem, volume e preço de todos os volumes.',
    };
  }

  return {
    sectionTitle: 'Tamanhos',
    sectionDescription: 'Esses valores aparecem nos cards do cardápio e no carrinho.',
    nameLabel: 'Nome',
    namePlaceholder: 'M',
    detailLabel: 'Porção',
    detailPlaceholder: 'Serve 1 pessoa',
    addLabel: 'Adicionar',
    emptySimpleTitle: 'Produto simples',
    emptySimpleDescription: 'Sobremesas usam apenas o preço principal e não precisam de tamanho M ou G.',
    invalidMessage: 'Preencha nome, porção e preço de todos os tamanhos.',
  };
}
