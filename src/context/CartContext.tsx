import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, MarmitaListItem, ProdutoTamanho } from '@/types/product';
import { toast } from '@/hooks/use-toast';

interface CartContextType {
  items: CartItem[];
  addToCart: (marmita: MarmitaListItem, tamanho?: ProdutoTamanho) => void;
  removeFromCart: (marmitaId: string) => void;
  updateQuantity: (marmitaId: string, quantidade: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (marmita: MarmitaListItem, tamanho?: ProdutoTamanho) => {
    setItems((currentItems) => {
      const selectedPrice = tamanho?.preco ?? marmita.preco;
      const selectedId = tamanho ? `${marmita.id}:${tamanho.codigo}` : marmita.id;
      const existingItem = currentItems.find((item) => item.id === selectedId);
      
      if (existingItem) {
        toast({
          title: "Quantidade atualizada!",
          description: `${marmita.nome}${tamanho ? ` - ${tamanho.nome}` : ''} agora tem ${existingItem.quantidade + 1} unidades.`,
        });
        return currentItems.map((item) =>
          item.id === selectedId
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      
      toast({
        title: "Adicionado ao carrinho!",
        description: `${marmita.nome}${tamanho ? ` - ${tamanho.nome}` : ''} foi adicionado.`,
      });
      return [...currentItems, { 
        id: selectedId,
        nome: marmita.nome,
        preco: selectedPrice,
        quantidade: 1,
        imagem_url: marmita.imagem_url,
        tamanho_codigo: tamanho?.codigo,
        tamanho_nome: tamanho?.nome,
        tamanho_serve: tamanho?.serve,
      }];
    });
  };

  const removeFromCart = (marmitaId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== marmitaId));
  };

  const updateQuantity = (marmitaId: string, quantidade: number) => {
    if (quantidade < 1) {
      removeFromCart(marmitaId);
      return;
    }
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === marmitaId ? { ...item, quantidade } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantidade, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
