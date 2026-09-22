import { AlertCircle, ArrowDown, Bike, Clock, Flame, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  deliveryNotice?: string | null;
}

const HERO_IMAGE_VERSION = '2026-09-21';
const BASE_URL = import.meta.env.BASE_URL;

export function HeroSection({ deliveryNotice }: HeroSectionProps) {
  return (
    <section id="inicio" className="relative min-h-[92svh] scroll-mt-24 overflow-hidden bg-[#120b08] pt-24 text-white md:min-h-screen md:scroll-mt-16 md:pt-16">
      <picture>
        <source
          type="image/webp"
          srcSet={`${BASE_URL}hero/restaurante-modelo-hero-768.webp?v=${HERO_IMAGE_VERSION} 768w, ${BASE_URL}hero/restaurante-modelo-hero-1280.webp?v=${HERO_IMAGE_VERSION} 1280w, ${BASE_URL}hero/restaurante-modelo-hero-1920.webp?v=${HERO_IMAGE_VERSION} 1920w`}
          sizes="100vw"
        />
        <img
          src={`${BASE_URL}hero/restaurante-modelo-hero.jpg?v=${HERO_IMAGE_VERSION}`}
          alt="Prato grelhado fatiado com tomates, cebolas e ervas, servido em tábua de madeira"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] animate-hero-ken-burns md:object-center"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,rgba(63,42,26,0.55)_0%,rgba(28,19,12,0.72)_55%,rgba(18,11,8,0.88)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,6,0.94)_0%,rgba(10,8,6,0.76)_45%,rgba(10,8,6,0.36)_78%,rgba(10,8,6,0.12)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.46)_0%,rgba(0,0,0,0.12)_40%,rgba(0,0,0,0.58)_100%)]" />
      <div className="absolute left-[55%] top-[24%] hidden h-40 w-24 rounded-full bg-white/20 blur-3xl animate-steam-rise md:block" />
      <div className="absolute left-[61%] top-[18%] hidden h-48 w-20 rounded-full bg-white/14 blur-3xl animate-steam-rise [animation-delay:1.4s] md:block" />

      <div className="container relative z-10 mx-auto flex min-h-[calc(92svh-6rem)] items-center px-4 py-8 md:min-h-[calc(100vh-4rem)] md:py-16">
        <div className="max-w-3xl space-y-6 md:space-y-8">
          {deliveryNotice && (
            <div className="max-w-xl rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-xs leading-relaxed text-white animate-fade-in sm:px-4 sm:py-3 sm:text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{deliveryNotice}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 animate-fade-in">
            <img src={`${BASE_URL}placeholder.svg`} alt="Restaurante Modelo" className="h-12 w-20 rounded-lg object-cover shadow-card sm:h-16 sm:w-28" />
            <div className="hidden sm:block">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">Comida feita na hora</p>
              <p className="text-sm text-white/64">Restaurante Modelo</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-5">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-2 text-xs font-bold text-primary backdrop-blur animate-fade-in sm:px-4 sm:text-sm">
              <Leaf className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              Prato do dia: Filé ao Molho Madeira
            </div>

            <p className="max-w-2xl text-xl font-extrabold leading-snug text-white drop-shadow-2xl sm:text-2xl md:text-4xl lg:text-5xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Peça seu prato favorito direto pelo WhatsApp, sem fila e sem comissão de aplicativo!
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 animate-fade-in sm:gap-3" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="lg" asChild className="min-w-[8.5rem] flex-1 rounded-full px-5 font-extrabold shadow-glow sm:flex-none sm:px-8">
              <a href="#cardapio">Pedir agora</a>
            </Button>
            <Button variant="outline" size="lg" asChild className="min-w-[8.5rem] flex-1 rounded-full border-white/34 bg-white/8 px-5 font-extrabold text-white hover:bg-white/16 sm:flex-none sm:px-8">
              <a href="#cardapio">Ver cardápio</a>
            </Button>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-2 pt-1 animate-fade-in sm:gap-3 sm:pt-2" style={{ animationDelay: '0.4s' }}>
            <div className="rounded-xl border border-white/12 bg-black/24 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Clock className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Pronto para servir</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/24 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Bike className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Entrega rápida!</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/24 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Flame className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Molho marcante</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 animate-bounce md:block">
          <a href="#cardapio" className="text-white/64 transition-colors hover:text-primary">
            <ArrowDown className="h-6 w-6" />
          </a>
        </div>
      </div>
    </section>
  );
}
