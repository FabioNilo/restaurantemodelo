import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Armchair,
  BarChart3,
  Bike,
  ExternalLink,
  Loader2,
  LogOut,
  Settings,
  ShieldAlert,
  Trophy,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
export default function AdminLayout() {
  const { user, loading, permissions, signOut } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="sticky top-0 z-30 flex flex-col gap-3 bg-brand-deep px-3 py-3 text-secondary-foreground print:hidden lg:h-screen lg:w-64 lg:shrink-0 lg:gap-6 lg:px-4 lg:py-6">
        <div className="flex items-center gap-3 px-1">
          <img src={BRAND.logo.sm} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full ring-1 ring-primary/50" />
          <div className="min-w-0 flex-1">
            <p className="truncate pt-0.5 font-display text-xl font-bold leading-normal text-primary">{BRAND.shortName}</p>
            <p className="truncate text-xs text-secondary-foreground/60">
              {user.username}
              {permissions.role === 'gestor' ? ' · caixa' : ''}
            </p>
          </div>
          <button onClick={sair} className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary-foreground/60 hover:bg-white/5 hover:text-primary lg:hidden" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible" aria-label="Seções do painel">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'text-secondary-foreground/65 hover:bg-white/5 hover:text-secondary-foreground'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-secondary-foreground/65 hover:bg-white/5 hover:text-secondary-foreground lg:mt-4"
          >
            <ExternalLink className="h-[18px] w-[18px]" /> Ver cardápio
          </a>
        </nav>

        <button onClick={sair} className="mt-auto hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-secondary-foreground/65 hover:bg-white/5 hover:text-primary lg:flex">
          <LogOut className="h-[18px] w-[18px]" /> Sair
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-gold-ink" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
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
