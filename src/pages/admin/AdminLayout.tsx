import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Armchair,
  BarChart3,
  Bike,
  ExternalLink,
  Loader2,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Trophy,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { TelaCheia, TelaCheiaFrame } from '@/components/admin/TelaCheia';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Painel com menu lateral (estrutura do plataforma-restaurantes/app/painel),
// nas cores da marca. Cada seção é uma rota filha renderizada no <Outlet/>.
// No celular, as seções do dia a dia ficam na barra inferior; o resto vai em "Mais".
const PRINCIPAIS_MOBILE = ['/admin/mesas', '/admin/caixa', '/admin/cardapio'];

export default function AdminLayout() {
  const { user, loading, permissions, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [maisAberto, setMaisAberto] = useState(false);
  const [cardapioAberto, setCardapioAberto] = useState(false);

  // Trocar de seção fecha o "Mais".
  useEffect(() => setMaisAberto(false), [pathname]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold-ink" />
      </div>
    );
  }

  if (!permissions.canAccessAdminPanel) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <ShieldAlert className="h-14 w-14 text-destructive" />
        <p className="font-display text-3xl text-secondary">Acesso negado</p>
        <Button variant="outline" onClick={() => signOut().then(() => navigate('/auth'))}>
          Sair
        </Button>
      </div>
    );
  }

  const items: NavItem[] = [
    { to: '/admin/mesas', label: 'Mesas', icon: Armchair },
    { to: '/admin/delivery', label: 'Delivery', icon: Bike },
    { to: '/admin/caixa', label: 'Caixa', icon: Wallet },
    { to: '/admin/cardapio', label: 'Cardápio', icon: UtensilsCrossed },
    ...(permissions.canViewReports
      ? [
          { to: '/admin/metricas', label: 'Métricas', icon: BarChart3 },
          { to: '/admin/desempenho', label: 'Desempenho', icon: Trophy },
        ]
      : []),
    ...(permissions.canManageSettings ? [{ to: '/admin/configuracoes', label: 'Configurações', icon: Settings }] : []),
  ];

  const sair = async () => {
    await signOut();
    navigate('/auth');
  };

  const principais = items.filter((item) => PRINCIPAIS_MOBILE.includes(item.to));
  const secundarios = items.filter((item) => !PRINCIPAIS_MOBILE.includes(item.to));
  const editandoProduto = pathname.startsWith('/admin/marmitas');
  const atual = items.find((item) => pathname.startsWith(item.to));
  // Editar produto fica dentro de Cardápio.
  const tituloSecao = atual?.label ?? (editandoProduto ? 'Cardápio' : 'Painel');
  const maisAtivo = secundarios.some((item) => pathname.startsWith(item.to));
  const linkLateral = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'text-secondary-foreground/65 hover:bg-white/5 hover:text-secondary-foreground'
    );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Celular: topo enxuto com a seção atual. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-brand-deep px-4 text-secondary-foreground print:hidden lg:hidden">
        <img src={BRAND.logo.sm} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full ring-1 ring-primary/50" />
        <p className="min-w-0 flex-1 truncate font-display text-xl font-bold text-primary">{tituloSecao}</p>
        <p className="max-w-[40%] truncate text-xs text-secondary-foreground/60">
          {user.username}
          {permissions.role === 'gestor' ? ' · caixa' : ''}
        </p>
      </header>

      {/* Computador: menu lateral. */}
      <aside className="sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-brand-deep px-4 py-6 text-secondary-foreground print:hidden lg:flex">
        <div className="flex items-center gap-3 px-1">
          <img src={BRAND.logo.sm} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full ring-1 ring-primary/50" />
          <div className="min-w-0 flex-1">
            <p className="truncate pt-0.5 font-display text-xl font-bold leading-normal text-primary">{BRAND.shortName}</p>
            <p className="truncate text-xs text-secondary-foreground/60">
              {user.username}
              {permissions.role === 'gestor' ? ' · caixa' : ''}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Seções do painel">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkLateral}>
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setCardapioAberto(true)} className={cn(linkLateral({ isActive: false }), 'mt-4')}>
            <ExternalLink className="h-[18px] w-[18px]" /> Ver cardápio
          </button>
        </nav>

        <button onClick={sair} className="mt-auto flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-secondary-foreground/65 hover:bg-white/5 hover:text-primary">
          <LogOut className="h-[18px] w-[18px]" /> Sair
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-gold-ink" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Celular: barra inferior ao alcance do polegar. */}
      <nav
        aria-label="Seções do painel (celular)"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-brand-deep pb-[env(safe-area-inset-bottom)] text-secondary-foreground print:hidden lg:hidden"
      >
        {principais.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold',
                isActive || (to === '/admin/cardapio' && editandoProduto) ? 'text-primary' : 'text-secondary-foreground/60'
              )
            }
          >
            <Icon className="h-6 w-6" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold', maisAtivo ? 'text-primary' : 'text-secondary-foreground/60')}
          aria-haspopup="dialog"
        >
          <Menu className="h-6 w-6" />
          Mais
        </button>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" className="rounded-t-[1.5rem] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
          <SheetTitle className="font-display text-2xl text-secondary">Mais opções</SheetTitle>
          <SheetDescription className="sr-only">Outras seções do painel</SheetDescription>
          <div className="mt-4 grid gap-1">
            {secundarios.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn('flex h-12 items-center gap-3 rounded-xl px-3 text-base font-medium', isActive ? 'bg-primary/15 text-gold-ink' : 'hover:bg-muted')
                }
              >
                <Icon className="h-5 w-5" /> {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMaisAberto(false);
                setCardapioAberto(true);
              }}
              className="flex h-12 items-center gap-3 rounded-xl px-3 text-base font-medium hover:bg-muted"
            >
              <ExternalLink className="h-5 w-5" /> Ver cardápio
            </button>
            <button type="button" onClick={sair} className="flex h-12 items-center gap-3 rounded-xl px-3 text-base font-medium text-destructive hover:bg-destructive/10">
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <TelaCheia open={cardapioAberto} onOpenChange={setCardapioAberto} titulo="Cardápio como o cliente vê">
        {cardapioAberto && <TelaCheiaFrame src={import.meta.env.BASE_URL} titulo="Cardápio do site" />}
      </TelaCheia>
    </div>
  );
}

// Bloqueia uma rota para quem não tem a permissão (ex.: gestor em Métricas).
export function SomenteAdmin({ children }: { children: React.ReactNode }) {
  const { permissions } = useAuth();

  if (permissions.role !== 'admin') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <p className="font-display text-2xl text-secondary">Só o administrador acessa esta seção.</p>
      </div>
    );
  }

  return <>{children}</>;
}
