import { Instagram, MessageCircle } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { buildWhatsAppUrl, DEFAULT_SITE_SETTINGS } from '@/lib/site-settings';

interface FooterProps {
  whatsappNumber?: string;
}

export function Footer({ whatsappNumber = DEFAULT_SITE_SETTINGS.whatsapp_numero }: FooterProps) {
  const businessWhatsAppUrl = buildWhatsAppUrl(whatsappNumber);

  return (
    <footer id="contato" className="scroll-mt-28 border-t border-primary/25 bg-brand-deep py-16 text-secondary-foreground md:scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid gap-12 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={BRAND.logo.sm} alt={BRAND.name} width={56} height={56} loading="lazy" className="h-14 w-14 rounded-full ring-1 ring-primary/50 shadow-soft" />
              <span className="flex flex-col">
                <span className="font-display text-3xl font-bold leading-none text-primary">{BRAND.wordmark}</span>
                <span className="brand-caps mt-1 text-[0.6rem] leading-normal text-brand-gold-soft/85">{BRAND.tagline}</span>
              </span>
            </div>
            <p className="text-sm text-secondary-foreground/70">
              Café, bolos caseiros, salgados e doces em {BRAND.city}. Peça pelo cardápio e finalize no WhatsApp.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-display text-xl font-bold text-primary">Links rápidos</h4>
            <ul className="space-y-2">
              <li><a href="#inicio" className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary">Início</a></li>
              <li><a href="#cardapio" className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary">Cardápio</a></li>
              <li><a href="#sobre" className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary">Sobre</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-xl font-bold text-primary">Contato</h4>
            <ul className="space-y-2">
              <li>
                <a href={businessWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary">
                  WhatsApp {BRAND.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary">
                  @{BRAND.instagram}
                </a>
              </li>
              <li className="text-sm text-secondary-foreground/70">{BRAND.address}</li>
              <li className="text-sm text-secondary-foreground/70">{BRAND.city}</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-xl font-bold text-primary">Redes sociais</h4>
            <div className="flex gap-3">
              <a
                href={BRAND.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-white/5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href={businessWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-white/5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-primary/15 pt-8 text-center">
          <p className="text-sm text-secondary-foreground/50">
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-secondary-foreground/60">
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
