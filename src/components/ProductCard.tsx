import { useId, useState } from 'react';
import { Check, ChevronDown, CupSoda, Plus, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarmitaListItem } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { getCatalogImageSources } from '@/lib/catalog-image';
import { getCategoryIcon, isBeverageCategory } from '@/lib/product-category';
import { ProductImageFallback } from '@/components/ProductImageFallback';

interface ProductCardProps {
  marmita: MarmitaListItem;
  categoriaNome?: string;
  index: number;
}

// Acima disso, as opções viram uma lista suspensa (ex.: 15 sabores de picolé).
const MAX_OPTION_BUTTONS = 3;

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function PortionIcon({ serve, isBeverage }: { serve?: string; isBeverage?: boolean }) {
  if (isBeverage) {
    return <CupSoda className="h-3.5 w-3.5" aria-label="Volume da bebida" />;
  }

  // Ícone de pessoas só faz sentido quando o detalhe fala de porção ("Serve 2 pessoas").
  if (!/pessoa/i.test(serve ?? '')) {
    return null;
  }

  const isSinglePortion = /\b1\b|uma|um/i.test(serve ?? '');
  const Icon = isSinglePortion ? User : Users;

  return <Icon className="h-3.5 w-3.5" aria-label={isSinglePortion ? 'Uma pessoa' : 'Duas pessoas'} />;
}

export function ProductCard({ marmita, categoriaNome, index }: ProductCardProps) {
  const { addToCart } = useCart();
  const selectId = useId();
  const imageSources = getCatalogImageSources(marmita.imagem_url);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedSizeCode, setSelectedSizeCode] = useState(marmita.tamanhos?.[0]?.codigo ?? '');
  const [addedSizeCode, setAddedSizeCode] = useState<string | null>(null);
  const showImage = imageSources && !imageFailed;
  const sizes = marmita.tamanhos ?? [];
  const useDropdown = sizes.length > MAX_OPTION_BUTTONS;
  const selectedSize = sizes.find((size) => size.codigo === selectedSizeCode) ?? sizes[0];
  const lowerPrice = sizes.length > 0
    ? Math.min(...sizes.map((size) => size.preco))
    : marmita.preco;
  const currentPrice = selectedSize?.preco ?? lowerPrice;
  const categoryContext = marmita.categoria_id || categoriaNome
    ? { id: marmita.categoria_id ?? categoriaNome ?? '', nome: categoriaNome ?? marmita.categoria_id ?? '' }
    : null;
  const isBebida = isBeverageCategory(categoryContext);
  const CategoryIcon = getCategoryIcon(categoryContext);

  const handleAddToCart = () => {
    addToCart({ ...marmita, preco: currentPrice }, selectedSize);
    setAddedSizeCode(selectedSize?.codigo ?? 'default');
    window.setTimeout(() => setAddedSizeCode(null), 2200);
  };

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-primary/25 bg-card shadow-card transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-card-hover animate-fade-in-up"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted sm:aspect-[16/11]">
        {showImage ? (
          <>
            {/* Fundo: a própria foto desfocada preenche o card; a foto inteira (sem corte) fica por cima. */}
            <img
              src={imageSources.src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
            />
            <img
              src={imageSources.src}
              srcSet={imageSources.srcSet}
              sizes={imageSources.sizes}
              alt={marmita.nome}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="relative h-full w-full object-contain transition-transform duration-700 group-hover:scale-105"
            />
          </>
        ) : (
          <ProductImageFallback
            name={marmita.nome}
            categoryName={categoriaNome}
            categoryId={marmita.categoria_id}
          />
        )}
        {showImage && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {categoriaNome && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-secondary shadow-soft backdrop-blur">
              <CategoryIcon className="h-3.5 w-3.5 text-gold-ink" />
              {categoriaNome}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <h3 className="font-display text-2xl font-bold leading-tight text-card-foreground">
            {marmita.nome}
          </h3>
          {marmita.descricao && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {marmita.descricao}
            </p>
          )}
        </div>

        {sizes.length > 0 && useDropdown && (
          <div className="space-y-1.5">
            <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Escolha o sabor
            </label>
            <div className="relative">
              <select
                id={selectId}
                value={selectedSize?.codigo ?? ''}
                onChange={(event) => setSelectedSizeCode(event.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-border bg-muted/60 pl-3 pr-10 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {sizes.map((size) => (
                  <option key={size.codigo} value={size.codigo}>
                    {size.nome}{size.serve ? ` · ${size.serve}` : ''} — {formatCurrency(size.preco)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        )}

        {sizes.length > 0 && !useDropdown && (
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
                  {size.serve && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PortionIcon serve={size.serve} isBeverage={isBebida} />
                      {size.serve}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-display text-xl font-bold text-gold-ink">
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

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {useDropdown ? 'Preço' : sizes.length > 0 ? 'A partir de' : 'Preço'}
            </p>
            <p className="font-display text-3xl font-bold text-gold-ink">
              {formatCurrency(useDropdown ? currentPrice : lowerPrice)}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddToCart}
            className="h-11 rounded-full px-4 font-bold text-primary"
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </article>
  );
}
