import { Award, CheckCircle, Heart, Leaf } from 'lucide-react';

const features = [
  {
    icon: Leaf,
    title: 'Ingredientes Selecionados',
    description: 'Produtos frescos, temperos e ingredientes escolhidos com cuidado.',
  },
  {
    icon: Heart,
    title: 'Receitas Caseiras',
    description: 'Cada prato valoriza sabor, tempero e o cuidado de comida feita na hora.',
  },
  {
    icon: Award,
    title: 'Qualidade Garantida',
    description: 'Padrão de preparo pensado para manter sabor, apresentação e consistência.',
  },
];

const benefits = [
  'Ingredientes frescos',
  'Porções fartas',
  'Opções variadas',
  'Molhos e temperos da casa',
  'Receitas tradicionais',
  'Embalagens sustentáveis',
];

export function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-28 bg-secondary py-20 text-secondary-foreground md:scroll-mt-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <div>
              <span className="mb-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                Sobre Nós
              </span>
              <h2 className="mb-6 font-display text-4xl font-black md:text-5xl">
                Tradição e sabor em cada <span className="text-gradient">prato</span>
              </h2>
              <p className="text-lg leading-relaxed text-secondary-foreground/78">
                O Restaurante Modelo nasceu para juntar receita caseira e agilidade no delivery. Preparamos pratos, porções e combinações pensadas para quem quer pedir bem, comer melhor e repetir.
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

          <div className="grid gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/10 p-6 shadow-soft backdrop-blur transition-shadow duration-300 hover:shadow-card">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/18">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="mb-2 font-display text-lg font-bold">{feature.title}</h3>
                  <p className="text-sm text-secondary-foreground/72">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
