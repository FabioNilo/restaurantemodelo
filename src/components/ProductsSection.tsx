import { useState } from 'react';
import { ProductCard } from './ProductCard';
import { Button } from '@/components/ui/button';
import { useMarmitas } from '@/hooks/useMarmitas';
import { Loader2 } from 'lucide-react';

export function ProductsSection() {
  const { marmitas, categorias, loading, error } = useMarmitas();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const filteredMarmitas = selectedCategoryId
    ? marmitas.filter((m) => m.categoria_id === selectedCategoryId)
    : marmitas;

  const categoriaMap = new Map(categorias.map((c) => [c.id, c.nome]));

  return (
    <section id="cardapio" className="relative scroll-mt-28 overflow-hidden py-20 md:scroll-mt-16 md:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(38_36%_90%))]" />
      <div className="container relative mx-auto px-4">
        <div className="mb-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <span className="inline-block rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground shadow-soft">
              Cardápio da casa
            </span>
            <h2 className="mt-5 font-display text-4xl font-black leading-tight md:text-6xl">
              Escolha seu <span className="text-gradient">pedido</span>
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground lg:justify-self-end">
            Pratos principais, porções, sobremesas e bebidas para completar a refeição.
          </p>
        </div>

        <div className="mb-12 flex flex-wrap justify-center gap-3">
          <Button
            variant={selectedCategoryId === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategoryId(null)}
            className="rounded-full px-5 font-bold"
          >
            Todos
          </Button>
          {categorias.map((categoria) => (
            <Button
              key={categoria.id}
              variant={selectedCategoryId === categoria.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategoryId(categoria.id)}
              className="rounded-full px-5 font-bold"
            >
              {categoria.nome}
            </Button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            {filteredMarmitas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">Nenhum item disponível no momento.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMarmitas.map((marmita, index) => (
                  <ProductCard
                    key={marmita.id}
                    marmita={marmita}
                    categoriaNome={marmita.categoria_id ? categoriaMap.get(marmita.categoria_id) : undefined}
                    index={index}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
