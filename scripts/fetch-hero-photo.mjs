// Baixa a foto de fundo do hero (Unsplash, licença livre, uso comercial
// permitido) e gera as variantes responsivas em /public/hero.
// Rode com: node scripts/fetch-hero-photo.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/hero');
// Filé fatiado grelhado com tomates e ervas, boa área escura no canto
// superior (onde o texto do hero fica por cima) e prato completo, mais
// convidativo que um close extremo de textura de carne.
const PHOTO_ID = '1542365887-1149961dccc7';
const SOURCE_WIDTH = 2400;
const SOURCE_HEIGHT = 1500;
const WIDTHS = [768, 1280, 1920];

async function fetchSource() {
  const url = `https://images.unsplash.com/photo-${PHOTO_ID}?w=${SOURCE_WIDTH}&q=85&fit=crop&fm=jpg`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const buffer = await fetchSource();

  for (const width of WIDTHS) {
    const height = Math.round((width / SOURCE_WIDTH) * SOURCE_HEIGHT);

    await sharp(buffer)
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toFile(path.join(OUT_DIR, `restaurante-modelo-hero-${width}.webp`));

    console.log('wrote', `restaurante-modelo-hero-${width}.webp`);
  }

  // Fallback jpg simples (navegadores sem suporte a webp) na largura intermediária.
  await sharp(buffer)
    .resize(1280, Math.round((1280 / SOURCE_WIDTH) * SOURCE_HEIGHT), { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82 })
    .toFile(path.join(OUT_DIR, 'restaurante-modelo-hero.jpg'));

  console.log('wrote', 'restaurante-modelo-hero.jpg');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
