// Gera os assets da marca a partir do logo em docs/: recorta o disco verde
// (sem o anel do Instagram nem o fundo preto do print), aplica máscara
// circular com fundo transparente e exporta logo, favicon e og-image.
// Rode com: node scripts/build-brand-assets.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.resolve('docs/nosso-bistro-cafe-logo-hd-v2.png');
const OUT_DIR = path.resolve('public/brand');
const PUBLIC_DIR = path.resolve('public');

// Medido no PNG 1992x1744: disco verde vai de x 228–1699 e y 128–1620.
// O raio fica um pouco menor que a borda para não pegar o contorno escuro.
const CENTER_X = 964;
const CENTER_Y = 874;
const RADIUS = 728;

const LOGO_SIZES = [128, 256, 512];
const BRAND_GREEN_DEEP = { r: 15, g: 31, b: 20 };

function circleMask(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
  );
}

async function buildMasterLogo() {
  const diameter = RADIUS * 2;

  return sharp(SOURCE)
    .extract({ left: CENTER_X - RADIUS, top: CENTER_Y - RADIUS, width: diameter, height: diameter })
    .ensureAlpha()
    .composite([{ input: circleMask(diameter), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

// ICO com uma única imagem PNG embutida (suportado por todos os navegadores atuais).
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size >= 256 ? 0 : size, 6);
  header.writeUInt8(size >= 256 ? 0 : size, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const master = await buildMasterLogo();

  for (const size of LOGO_SIZES) {
    const resized = sharp(master).resize(size, size);
    await resized.clone().png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, `logo-${size}.png`));
    await resized.clone().webp({ quality: 88 }).toFile(path.join(OUT_DIR, `logo-${size}.webp`));
    console.log('wrote', `logo-${size}.png/.webp`);
  }

  await sharp(master).resize(180, 180).flatten({ background: BRAND_GREEN_DEEP }).png().toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));
  console.log('wrote apple-touch-icon.png');

  const favicon48 = await sharp(master).resize(48, 48).png().toBuffer();
  await writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), pngToIco(favicon48, 48));
  console.log('wrote favicon.ico');

  const ogLogo = await sharp(master).resize(520, 520).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: { ...BRAND_GREEN_DEEP, alpha: 1 } } })
    .composite([{ input: ogLogo, top: 55, left: 340 }])
    .jpeg({ quality: 86 })
    .toFile(path.join(OUT_DIR, 'og-image.jpg'));
  console.log('wrote og-image.jpg');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
