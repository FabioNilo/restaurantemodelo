import { ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onCartClick: () => void;
}

export function Header({ onCartClick }: HeaderProps) {
  const { totalItems } = useCart();
  const menuLinks = [
    { href: '#inicio', label: 'Início' },
    { href: '#cardapio', label: 'Cardápio' },
    { href: '#sobre', label: 'Sobre' },
    { href: '#contato', label: 'Contato' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-primary/25 bg-[#3f4d27]/96 text-primary shadow-card backdrop-blur-xl">
      <div className="container mx-auto flex min-h-16 flex-col gap-2 px-3 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:px-4 md:py-0">
        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-start">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/placeholder.svg" alt="Restaurante Modelo" className="h-12 w-16 shrink-0 rounded-md object-cover shadow-soft md:w-20" />
            <span className="truncate font-display text-lg font-bold leading-tight text-background md:text-xl">
            Restaurante <span className="text-primary">Modelo</span>
            </span>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" asChild className="h-10 rounded-full border border-primary/45 bg-primary/15 px-3 text-xs font-extrabold uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground">
              <Link to="/auth" aria-label="Área administrativa">
                Admin
              </Link>
            </Button>
            <Button variant="cart" size="icon" onClick={onCartClick} className="relative h-11 w-11 rounded-full shadow-soft">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-secondary animate-scale-in">
                  {totalItems}
                </span>
              )}
            </Button>
          </div>
        </div>

        <nav className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:gap-8 md:overflow-visible md:pb-0">
          {menuLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-primary transition-colors hover:bg-primary/15 hover:text-[#ffd36a] md:px-0 md:py-0 md:text-base md:hover:bg-transparent"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild className="h-10 rounded-full border border-primary/45 bg-primary/15 px-4 font-extrabold uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground">
            <Link to="/auth">
              <User className="mr-2 h-4 w-4" />
              Admin
            </Link>
          </Button>
          <Button variant="cart" size="icon" onClick={onCartClick} className="relative shadow-soft">
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center animate-scale-in">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
