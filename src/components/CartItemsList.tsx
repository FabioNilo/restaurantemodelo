import { Minus, Plus, Trash2 } from 'lucide-react';
import { ProductImageFallback } from '@/components/ProductImageFallback';
import { useCart } from '@/context/CartContext';
import { getCatalogImageSrc } from '@/lib/catalog-image';

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Itens do carrinho com +/−/remover. Usado no carrinho do delivery (CartModal)
// e no da mesa (MesaCartModal).
export function CartItemsList() {
  const { items, updateQuantity, removeFromCart } = useCart();

  return (
    <>
      {items.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-display text-xl font-bold">Seu carrinho está vazio</p>
          <p className="mt-2 text-sm text-muted-foreground">Escolha um item do cardápio para continuar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const imageSrc = getCatalogImageSrc(item.imagem_url);

            return (
              <div key={item.id} className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
                {imageSrc ? (
                  <img src={imageSrc} alt={item.nome} className="h-24 w-24 rounded-xl object-cover" />
                ) : (
                  <ProductImageFallback name={item.nome} compact className="h-24 w-24 shrink-0 rounded-xl" />
                )}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-display text-base font-black leading-tight">{item.nome}</h4>
                      {item.tamanho_nome && (
                        <p className="mt-1 text-xs font-bold text-secondary">
                          {item.tamanho_serve ? `${item.tamanho_nome} · ${item.tamanho_serve}` : item.tamanho_nome}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-display text-lg font-black text-gold-ink">
                      {formatCurrency(item.preco)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
                      aria-label={`Diminuir ${item.nome}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center font-black">{item.quantidade}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
                      aria-label={`Aumentar ${item.nome}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                      aria-label={`Remover ${item.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
