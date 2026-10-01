import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { BRAND } from '@/lib/brand';

interface HeaderProps {
  onCartClick: () => void;
  // Página da mesa (QR code): troca os links âncora pelo selo da mesa.
  mesaLabel?: string;
}

export function Header({ onCartClick, mesaLabel }: HeaderProps) {
  const { totalItems } = useCart();
  const menuLinks = [
    { href: '#inicio', label: 'Início' },
    { href: '#cardapio', label: 'Cardápio' },
    { href: '#sobre', label: 'Sobre' },
    { href: '#contato', label: 'Contato' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-primary/30 bg-brand-deep/95 text-primary shadow-card backdrop-blur-xl">
      <div className="container mx-auto flex min-h-16 flex-col gap-2 px-3 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:px-4 md:py-0">
        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-start">
          <a href="#inicio" className="flex min-w-0 items-center gap-2.5">
            <img
              src={BRAND.logo.sm}
              alt={BRAND.name}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full ring-1 ring-primary/50 shadow-soft"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-display text-2xl font-bold leading-none text-primary">{BRAND.wordmark}</span>
              <span className="brand-caps mt-1 whitespace-nowrap text-[0.6rem] leading-normal text-brand-gold-soft/85">{BRAND.tagline}</span>
            </span>
          </a>

          <div className="flex items-center gap-2 md:hidden">
            {mesaLabel && (
              <span className="brand-caps rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[0.62rem] text-primary">
                {mesaLabel}
              </span>
            )}
            <Button variant="cart" size="icon" onClick={onCartClick} className="relative h-11 w-11 rounded-full shadow-soft" aria-label="Abrir carrinho">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-secondary animate-scale-in">
                  {totalItems}
                </span>
              )}
            </Button>
          </div>
        </div>

        {mesaLabel ? (
          <p className="brand-caps hidden rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[0.7rem] text-primary md:block">
            {mesaLabel}
          </p>
        ) : (
          <nav className="flex w-full items-center justify-between gap-1 overflow-x-auto md:justify-start pb-1 scrollbar-none md:w-auto md:gap-8 md:overflow-visible md:pb-0">
            {menuLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="brand-caps shrink-0 rounded-full px-2.5 py-2 text-[0.68rem] !tracking-[0.16em] text-primary/90 md:!tracking-[0.3em] transition-colors hover:bg-primary/15 hover:text-brand-gold-soft md:px-0 md:py-0 md:text-xs md:hover:bg-transparent"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="cart" size="icon" onClick={onCartClick} className="relative shadow-soft" aria-label="Abrir carrinho">
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-background text-secondary text-xs font-bold rounded-full flex items-center justify-center animate-scale-in">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
