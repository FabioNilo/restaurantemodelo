import { AlertCircle, ArrowDown, Bike, Coffee, Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/brand';

interface HeroSectionProps {
  deliveryNotice?: string | null;
}

const HERO_IMAGE_VERSION = '2026-09-29b';
const BASE_URL = import.meta.env.BASE_URL;

export function HeroSection({ deliveryNotice }: HeroSectionProps) {
  return (
    <section id="inicio" className="relative min-h-[92svh] scroll-mt-24 overflow-hidden bg-brand-deep pt-24 text-white md:min-h-screen md:scroll-mt-16 md:pt-16">
      <picture>
        <source
          type="image/webp"
          srcSet={`${BASE_URL}hero/nosso-bistro-hero-768.webp?v=${HERO_IMAGE_VERSION} 768w, ${BASE_URL}hero/nosso-bistro-hero-1280.webp?v=${HERO_IMAGE_VERSION} 1280w, ${BASE_URL}hero/nosso-bistro-hero-1920.webp?v=${HERO_IMAGE_VERSION} 1920w`}
          sizes="100vw"
        />
        <img
          src={`${BASE_URL}hero/nosso-bistro-hero.jpg?v=${HERO_IMAGE_VERSION}`}
          alt="Cappuccinos com latte art sobre mesa de madeira, cercados de plantas"
          className="absolute inset-0 h-full w-full object-cover object-[72%_center] animate-hero-ken-burns md:object-center"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,hsl(135_38%_17%/0.5)_0%,hsl(140_35%_9%/0.35)_60%,hsl(140_35%_6%/0.55)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(140_35%_6%/0.95)_0%,hsl(140_35%_7%/0.82)_38%,hsl(140_35%_9%/0.3)_70%,hsl(140_35%_9%/0.05)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0)_35%,rgba(0,0,0,0.45)_100%)]" />
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

          <div className="flex items-center gap-4 animate-fade-in">
            <img
              src={BRAND.logo.md}
              srcSet={`${BRAND.logo.md} 1x, ${BRAND.logo.lg} 2x`}
              alt={BRAND.name}
              width={128}
              height={128}
              className="h-24 w-24 rounded-full ring-2 ring-primary/60 shadow-glow sm:h-32 sm:w-32"
            />
            <div className="space-y-2">
              <p className="brand-caps text-[0.65rem] text-primary sm:text-xs">Café · Bistrô · Delivery</p>
              <span className="divider-gold !w-24" aria-hidden="true" />
              <p className="text-sm text-white/70">{BRAND.city}</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-5">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/35 bg-white/10 px-3 py-2 text-xs font-bold text-brand-gold-soft backdrop-blur animate-fade-in sm:px-4 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              Promoção do dia: 2 fatias de torta por R$ 30
            </div>

            <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.05] text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Café fresquinho, bolos caseiros e salgados{' '}
              <span className="text-gradient italic">do nosso jeito</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/80 sm:text-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Peça direto pelo WhatsApp, sem fila e sem comissão de aplicativo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 animate-fade-in sm:gap-3" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="lg" asChild className="min-w-[8.5rem] flex-1 rounded-full px-5 font-bold shadow-glow sm:flex-none sm:px-8">
              <a href="#cardapio">Pedir agora</a>
            </Button>
            <Button variant="outline" size="lg" asChild className="min-w-[8.5rem] flex-1 rounded-full border-white/34 bg-white/8 px-5 font-bold text-white hover:bg-white/16 hover:text-white sm:flex-none sm:px-8">
              <a href="#cardapio">Ver cardápio</a>
            </Button>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-2 pt-1 animate-fade-in sm:gap-3 sm:pt-2" style={{ animationDelay: '0.4s' }}>
            <div className="rounded-xl border border-primary/20 bg-black/25 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Coffee className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Feito no dia</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-black/25 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Bike className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Entrega em Ilhéus</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-black/25 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
              <Heart className="mb-2 h-4 w-4 text-primary sm:mb-3 sm:h-5 sm:w-5" />
              <p className="text-xs font-bold leading-tight sm:text-sm">Receitas caseiras</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 animate-bounce md:block">
          <a href="#cardapio" className="text-white/64 transition-colors hover:text-primary" aria-label="Ir para o cardápio">
            <ArrowDown className="h-6 w-6" />
          </a>
        </div>
      </div>
    </section>
  );
}
