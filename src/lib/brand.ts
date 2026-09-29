// Identidade do cliente em um lugar só. Os assets em public/brand são
// gerados por scripts/build-brand-assets.mjs a partir do logo em docs/.
const BASE_URL = import.meta.env.BASE_URL;

export const BRAND = {
  name: 'Nosso Bistrô Café',
  shortName: 'Nosso Bistrô',
  wordmark: 'Nosso',
  tagline: 'Bistrô · Café',
  city: 'Ilhéus - BA',
  // Endereço ainda não confirmado com o cliente (ver README, "Pendências com o cliente").
  address: 'Endereço a confirmar',
  phoneDisplay: '(73) 99804-0470',
  instagram: 'nossobistro_ios',
  instagramUrl: 'https://instagram.com/nossobistro_ios',
  logo: {
    sm: `${BASE_URL}brand/logo-128.webp`,
    md: `${BASE_URL}brand/logo-256.webp`,
    lg: `${BASE_URL}brand/logo-512.webp`,
  },
} as const;
