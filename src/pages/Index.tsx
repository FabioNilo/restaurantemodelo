import { useState } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ProductsSection } from '@/components/ProductsSection';
import { AboutSection } from '@/components/AboutSection';
import { Footer } from '@/components/Footer';
import { CartModal } from '@/components/CartModal';
import { useSitePublicStatusQuery } from '@/hooks/useSitePublicStatusQuery';
import { SITE_OPEN_MESSAGE } from '@/lib/site-settings';

function IndexContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { data: siteStatus } = useSitePublicStatusQuery();
  const deliveryNotice = siteStatus?.entregas_abertas_agora ? SITE_OPEN_MESSAGE : siteStatus?.mensagem_fechado ?? null;
  const whatsappNumber = siteStatus?.whatsapp_numero;

  return (
    <div className="min-h-screen bg-background">
      <Header onCartClick={() => setIsCartOpen(true)} />
      <main>
        <HeroSection deliveryNotice={deliveryNotice} />
        <ProductsSection />
        <AboutSection />
      </main>
      <Footer whatsappNumber={whatsappNumber} />
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}

const Index = () => <IndexContent />;

export default Index;
