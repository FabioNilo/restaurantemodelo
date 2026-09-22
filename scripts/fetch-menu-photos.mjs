// Baixa fotos do Unsplash (licença Unsplash: uso livre, comercial incluso)
// para o cardápio de demonstração e já gera os webp 400w/800w que o app espera
// em /public/menu/{slug}-{400|800}.webp.
// Rode com: node scripts/fetch-menu-photos.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/menu');
const OUT_WIDTH = 800;
const OUT_HEIGHT = 600;

// Fotos escolhidas manualmente por afinidade com a descrição de cada prato,
// evitando fotos com marca/logotipo visível (ex.: latas de refrigerante de
// marca real foram descartadas em favor de latas lisas).
const PHOTOS = {
  'frango-grelhado-molho-da-casa': '1670398564097-0762e1b30b3a',
  'file-ao-molho-madeira': '1694345598429-00511c301452',
  'strogonofe-de-frango': '1644592219048-5c070fd3c91c',
  'peixe-grelhado-com-legumes': '1598511796432-32663d0875bd',
  'batata-frita-da-casa': '1598679253544-2c97992403ea',
  'isca-de-frango-empanada': '1562967914-608f82629710',
  'camarao-empanado': '1579670039509-e21e75007e4c',
  'pudim-de-leite': '1702728109878-c61a98d80491',
  'brownie-com-sorvete': '1624353365286-3f8d62daad51',
  'suco-natural': '1617319683252-027deeba5fd5',
  'refrigerante-lata': '1696739696228-eee49592ff07',
};

async function fetchImage(photoId) {
  const url = `https://images.unsplash.com/photo-${photoId}?w=1600&q=85&fit=crop&fm=jpg`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const [slug, photoId] of Object.entries(PHOTOS)) {
    const buffer = await fetchImage(photoId);

    for (const targetWidth of [400, 800]) {
      const targetHeight = Math.round((targetWidth / OUT_WIDTH) * OUT_HEIGHT);
      const outPath = path.join(OUT_DIR, `${slug}-${targetWidth}.webp`);

      await sharp(buffer)
        .resize(targetWidth, targetHeight, { fit: 'cover', position: 'attention' })
        .webp({ quality: 82 })
        .toFile(outPath);

      console.log('wrote', outPath);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
