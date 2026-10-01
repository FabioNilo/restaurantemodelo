import { useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Input } from '@/components/ui/input';
import { useMarmitas } from '@/hooks/useMarmitas';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import { getCategoryIcon, productMatchesSearch } from '@/lib/product-category';
import type { CategoriaListItem, MarmitaListItem } from '@/types/product';

interface ProductGroup {
  categoria: CategoriaListItem | null;
  items: MarmitaListItem[];
}

interface ProductsSectionProps {
  // Página da mesa (QR code): sem a introdução (o banner da mesa já explica) e
  // com a barra fixa grudando mais acima, já que o cabeçalho tem uma linha só.
  modoMesa?: boolean;
}

export function ProductsSection({ modoMesa = false }: ProductsSectionProps = {}) {
  const { marmitas, categorias, loading, error } = useMarmitas();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 200);
  const listTopRef = useRef<HTMLDivElement>(null);

  const categoriaMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const groups = useMemo<ProductGroup[]>(() => {
    const visible = marmitas.filter((marmita) => {
      if (selectedCategoryId && marmita.categoria_id !== selectedCategoryId) {
        return false;
      }

      const categoryName = marmita.categoria_id ? categoriaMap.get(marmita.categoria_id)?.nome : undefined;
      return productMatchesSearch(marmita, debouncedSearch, categoryName);
    });

    // Os produtos já chegam ordenados por categoria (useCatalogoPublicoQuery),
    // então basta quebrar a lista em blocos consecutivos.
    return visible.reduce<ProductGroup[]>((acc, marmita) => {
      const last = acc[acc.length - 1];
      const categoria = marmita.categoria_id ? categoriaMap.get(marmita.categoria_id) ?? null : null;

      if (last && last.categoria?.id === categoria?.id) {
        last.items.push(marmita);
      } else {
        acc.push({ categoria, items: [marmita] });
      }

      return acc;
    }, []);
  }, [marmitas, selectedCategoryId, debouncedSearch, categoriaMap]);

  const selectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    // Se a barra já está grudada no topo, volta para o início da lista filtrada.
    const listTop = listTopRef.current;
    if (listTop && listTop.getBoundingClientRect().top < 0) {
      listTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Categoria sem nenhum item disponível não vira aba (evita clicar e ver lista vazia).
  const categoryIdsWithItems = new Set(marmitas.map((marmita) => marmita.categoria_id));
  const tabs: Array<{ id: string | null; nome: string }> = [
    { id: null, nome: 'Todos' },
    ...categorias.filter((categoria) => categoryIdsWithItems.has(categoria.id)),
  ];
  let cardIndex = 0;

  return (
    <section id="cardapio" className={cn('relative scroll-mt-28 md:scroll-mt-16', modoMesa ? 'py-6 md:py-10' : 'py-20 md:py-24')}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(40_32%_91%))]" />
      <div className="container relative mx-auto px-4">
        {!modoMesa && (
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <span className="brand-caps inline-block rounded-full bg-secondary px-4 py-2 text-[0.65rem] text-primary shadow-soft">
                Cardápio da casa
              </span>
              <h2 className="mt-5 font-display text-5xl font-bold leading-tight text-secondary md:text-6xl">
                Escolha seu <span className="italic text-gold-ink">pedido</span>
              </h2>
              <span className="divider-gold mt-4" aria-hidden="true" />
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground lg:justify-self-end">
              Cafés, bolos caseiros, tortas, salgados, picolés, polpas e muito mais — tudo para pedir direto pelo WhatsApp.
            </p>
          </div>
        )}

        <div ref={listTopRef} className="scroll-mt-40 md:scroll-mt-36" />

        <div
          className={cn(
            'sticky z-30 -mx-4 mb-8 border-y border-primary/20 bg-background/95 px-4 py-3 shadow-soft backdrop-blur md:top-16 md:mx-0 md:rounded-2xl md:border',
            modoMesa ? 'top-[4.25rem]' : 'top-[6.4rem]'
          )}
        >
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar itens (ex.: cappuccino, bolo, açaí)"
              aria-label="Pesquisar itens do cardápio"
              className="h-11 rounded-full border-border bg-card pl-9 pr-10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Categorias do cardápio">
            {tabs.map((tab) => {
              const active = selectedCategoryId === tab.id;
              const Icon = tab.id ? getCategoryIcon(tab) : null;

              return (
                <button
                  key={tab.id ?? 'todos'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectCategory(tab.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'border-secondary bg-secondary text-primary shadow-soft'
                      : 'border-border bg-card text-secondary hover:border-primary/60 hover:bg-primary/10'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  {tab.nome}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gold-ink" />
            <span className="ml-2 text-muted-foreground">Carregando cardápio...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {groups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  {debouncedSearch.trim()
                    ? `Nenhum item encontrado para "${debouncedSearch.trim()}".`
                    : 'Nenhum item disponível no momento.'}
                </p>
              </div>
            ) : (
              <div className="space-y-14">
                {groups.map((group) => (
                  <div key={group.categoria?.id ?? 'sem-categoria'} className="space-y-6">
                    {group.categoria && (
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <h3 className="font-display text-3xl font-bold text-secondary md:text-4xl">
                            {group.categoria.nome}
                          </h3>
                          <span className="divider-gold mt-2 !w-20" aria-hidden="true" />
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    )}
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((marmita) => (
                        <ProductCard
                          key={marmita.id}
                          marmita={marmita}
                          categoriaNome={group.categoria?.nome}
                          index={cardIndex++ % 6}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
