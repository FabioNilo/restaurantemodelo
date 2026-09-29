// Baixa a foto de fundo do hero (Unsplash, licença livre, uso comercial
// permitido) e gera as variantes responsivas em /public/hero.
// Rode com: node scripts/fetch-hero-photo.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/hero');
// Cappuccinos com latte art (um deles com coração, como a xícara do logo)
// em mesa de madeira, cercados de plantas verdes — combina com o
// verde-floresta e o dourado do Nosso Bistrô Café. A foto original é
// vertical (2:3); recortamos uma faixa 16:10 na altura das xícaras.
const PHOTO_ID = '1509042239860-f550ce710b93';
const SOURCE_WIDTH = 2400;
const SOURCE_HEIGHT = 1500;
// Centro vertical da faixa, em fração da altura da foto original.
const CROP_CENTER_Y = 0.6;
const WIDTHS = [768, 1280, 1920];

async function fetchSource() {
  const url = `https://images.unsplash.com/photo-${PHOTO_ID}?w=${SOURCE_WIDTH}&q=85&fm=jpg`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const original = await fetchSource();
  const { height: originalHeight = SOURCE_HEIGHT } = await sharp(original).metadata();
  const top = Math.max(0, Math.min(originalHeight - SOURCE_HEIGHT, Math.round(originalHeight * CROP_CENTER_Y - SOURCE_HEIGHT / 2)));
  const buffer = await sharp(original)
    .extract({ left: 0, top, width: SOURCE_WIDTH, height: SOURCE_HEIGHT })
    .toBuffer();

  for (const width of WIDTHS) {
    const height = Math.round((width / SOURCE_WIDTH) * SOURCE_HEIGHT);

    await sharp(buffer)
      .resize(width, height, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(path.join(OUT_DIR, `nosso-bistro-hero-${width}.webp`));

    console.log('wrote', `nosso-bistro-hero-${width}.webp`);
  }

  // Fallback jpg simples (navegadores sem suporte a webp) na largura intermediária.
  await sharp(buffer)
    .resize(1280, Math.round((1280 / SOURCE_WIDTH) * SOURCE_HEIGHT), { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toFile(path.join(OUT_DIR, 'nosso-bistro-hero.jpg'));

  console.log('wrote', 'nosso-bistro-hero.jpg');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
