import { Instagram, Facebook, Phone } from 'lucide-react';
import { buildWhatsAppUrl, DEFAULT_SITE_SETTINGS } from '@/lib/site-settings';

interface FooterProps {
  whatsappNumber?: string;
}

export function Footer({ whatsappNumber = DEFAULT_SITE_SETTINGS.whatsapp_numero }: FooterProps) {
  const businessWhatsAppUrl = buildWhatsAppUrl(whatsappNumber);

  return (
    <footer id="contato" className="scroll-mt-28 bg-[#4a0b10] py-16 text-background md:scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid gap-12 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/placeholder.svg" alt="Restaurante Modelo" className="h-12 w-20 rounded-md object-cover shadow-soft" />
              <span className="font-display text-xl font-bold">
                Restaurante <span className="text-primary">Modelo</span>
              </span>
            </div>
            <p className="text-sm text-background/70">
              Comida feita na hora, cardápio digital e pedido direto pelo WhatsApp.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-display font-bold">Links Rápidos</h4>
            <ul className="space-y-2">
              <li><a href="#inicio" className="text-sm text-background/70 transition-colors hover:text-primary">Início</a></li>
              <li><a href="#cardapio" className="text-sm text-background/70 transition-colors hover:text-primary">Cardápio</a></li>
              <li><a href="#sobre" className="text-sm text-background/70 transition-colors hover:text-primary">Sobre</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display font-bold">Contato</h4>
            <ul className="space-y-2">
              <li className="text-sm text-background/70">(73) 99909-9040</li>
              <li className="text-sm text-background/70">contato@restaurantemodelo.com.br</li>
              <li className="text-sm text-background/70">Rua Exemplo, 123 - Centro</li>
              <li className="text-sm text-background/70">Ilhéus - BA</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display font-bold">Redes Sociais</h4>
            <div className="flex gap-3">
              <a href="#" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-colors hover:bg-primary hover:text-primary-foreground">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-colors hover:bg-primary hover:text-primary-foreground">
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href={businessWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Phone className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-background/10 pt-8 text-center">
          <p className="text-sm text-background/50">
            (c) 2026 Restaurante Modelo. Demonstração — Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-background/60">
            <span>Desenvolvido por</span>
            <a
              href="https://wa.me/5573999099040?text=Ola%20desenvolvedor%21%20Gostaria%20de%20conhecer%20mais%20sobre%20seus%20servicos%20de%20desenvolvimento%20web."
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary transition-colors hover:underline"
            >
              Solucoes Web Personalizadas
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
