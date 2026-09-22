import { useState } from 'react';
import { Check, ChefHat, CupSoda, Plus, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarmitaListItem } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { getCatalogImageSources } from '@/lib/catalog-image';
import { isBeverageCategory } from '@/lib/product-category';
import { ProductImageFallback } from '@/components/ProductImageFallback';

interface ProductCardProps {
  marmita: MarmitaListItem;
  categoriaNome?: string;
  index: number;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function PortionIcon({ serve, isBeverage }: { serve?: string; isBeverage?: boolean }) {
  if (isBeverage) {
    return <CupSoda className="h-3.5 w-3.5" aria-label="Volume da bebida" />;
  }

  const isSinglePortion = /\b1\b|uma|um/i.test(serve ?? '');
  const Icon = isSinglePortion ? User : Users;

  return <Icon className="h-3.5 w-3.5" aria-label={isSinglePortion ? 'Uma pessoa' : 'Duas pessoas'} />;
}

export function ProductCard({ marmita, categoriaNome, index }: ProductCardProps) {
  const { addToCart } = useCart();
  const imageSources = getCatalogImageSources(marmita.imagem_url);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedSizeCode, setSelectedSizeCode] = useState(marmita.tamanhos?.[0]?.codigo ?? '');
  const [addedSizeCode, setAddedSizeCode] = useState<string | null>(null);
  const showImage = imageSources && !imageFailed;
  const sizes = marmita.tamanhos ?? [];
  const selectedSize = sizes.find((size) => size.codigo === selectedSizeCode) ?? sizes[0];
  const lowerPrice = sizes.length > 0
    ? Math.min(...sizes.map((size) => size.preco))
    : marmita.preco;
  const currentPrice = selectedSize?.preco ?? lowerPrice;
  const categoryContext = marmita.categoria_id || categoriaNome
    ? { id: marmita.categoria_id ?? categoriaNome ?? '', nome: categoriaNome ?? marmita.categoria_id ?? '' }
    : null;
  const isBebida = isBeverageCategory(categoryContext);
  const CategoryIcon = isBebida ? CupSoda : ChefHat;

  const handleAddToCart = () => {
    addToCart({ ...marmita, preco: currentPrice }, selectedSize);
    setAddedSizeCode(selectedSize?.codigo ?? 'default');
    window.setTimeout(() => setAddedSizeCode(null), 2200);
  };

  return (
    <article
      className="group relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-card-hover animate-fade-in-up"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="relative h-56 overflow-hidden bg-muted">
        {showImage ? (
          <img
            src={imageSources.src}
            srcSet={imageSources.srcSet}
            sizes={imageSources.sizes}
            alt={marmita.nome}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <ProductImageFallback
            name={marmita.nome}
            categoryName={categoriaNome}
            price={lowerPrice}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {categoriaNome && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground shadow-soft backdrop-blur">
              <CategoryIcon className="h-3.5 w-3.5 text-primary" />
              {categoriaNome}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-2">
          <h3 className="font-display text-xl font-extrabold leading-tight text-card-foreground">
            {marmita.nome}
          </h3>
          {marmita.descricao && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {marmita.descricao}
            </p>
          )}
        </div>

        {sizes.length > 0 && (
          <div className="grid gap-2">
            {sizes.map((size) => (
              <button
                key={size.codigo}
                type="button"
                onClick={() => setSelectedSizeCode(size.codigo)}
                aria-pressed={selectedSizeCode === size.codigo}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition-all ${
                  selectedSizeCode === size.codigo
                    ? 'border-primary bg-primary/15 shadow-soft'
                    : 'border-border bg-muted/60 hover:border-primary/50 hover:bg-primary/10'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{size.nome}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PortionIcon serve={size.serve} isBeverage={isBebida} />
                    {size.serve}
                  </p>
                </div>
                <p className="shrink-0 font-display text-lg font-extrabold text-primary">
                  {formatCurrency(size.preco)}
                </p>
              </button>
            ))}
          </div>
        )}

        {addedSizeCode && (
          <div role="status" className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">
            <Check className="h-4 w-4 text-primary" />
            {selectedSize?.nome ?? 'Item'} adicionado ao carrinho
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {sizes.length > 0 ? 'A partir de' : 'Preço'}
            </p>
            <p className="font-display text-2xl font-black text-primary">
              {formatCurrency(lowerPrice)}
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleAddToCart}
            className="h-11 rounded-full px-4 font-bold"
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </article>
  );
}
