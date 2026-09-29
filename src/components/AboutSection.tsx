import { CheckCircle, Coffee, Heart, Leaf } from 'lucide-react';
import { BRAND } from '@/lib/brand';

const features = [
  {
    icon: Coffee,
    title: 'Café de verdade',
    description: 'Cappuccinos, mocha e bebidas com o chocolate Dois Frades, preparados na hora.',
  },
  {
    icon: Heart,
    title: 'Feito em casa',
    description: 'Bolos, tortas, biscoitos e doces caseiros, com receita de família.',
  },
  {
    icon: Leaf,
    title: 'Sabores da Bahia',
    description: 'Polpas de frutas da região, licores artesanais de jenipapo e munguzá.',
  },
];

const benefits = [
  'Bolos caseiros',
  'Tortas por fatia',
  'Salgados assados',
  'Polpas de fruta natural',
  'Licores artesanais',
  'Picolés e sorvetes',
];

export function AboutSection() {
  return (
    <section id="sobre" className="relative scroll-mt-28 overflow-hidden bg-brand-deep py-20 text-secondary-foreground md:scroll-mt-16 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,hsl(var(--secondary))_0%,transparent_55%)]" />
      <div className="container relative mx-auto px-4">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <div>
              <span className="brand-caps mb-4 inline-block rounded-full bg-primary px-4 py-2 text-[0.65rem] text-primary-foreground">
                Sobre nós
              </span>
              <h2 className="mb-4 font-display text-5xl font-bold md:text-6xl">
                Um cantinho de café em <span className="text-gradient italic">Ilhéus</span>
              </h2>
              <span className="divider-gold mb-6" aria-hidden="true" />
              <p className="text-lg leading-relaxed text-secondary-foreground/80">
                O {BRAND.name} é aquele lugar para um café sem pressa, uma fatia de bolo caseiro e um salgado quentinho. Agora também no delivery: você escolhe pelo cardápio e pede direto no nosso WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm text-secondary-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <img
              src={BRAND.logo.md}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width={112}
              height={112}
              className="mx-auto mb-8 hidden h-28 w-28 rounded-full ring-2 ring-primary/40 shadow-glow lg:block"
            />
            <div className="relative grid gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4 rounded-2xl border border-primary/20 bg-white/5 p-6 shadow-soft backdrop-blur transition-shadow duration-300 hover:shadow-card">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-display text-2xl font-bold text-brand-gold-soft">{feature.title}</h3>
                    <p className="text-sm text-secondary-foreground/75">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
