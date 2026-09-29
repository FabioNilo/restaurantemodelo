import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ApiError } from './http.js';
import { requireEnv } from './env.js';

// Fotos dos produtos no Neon Object Storage (compatível com S3), bucket
// "produtos" com leitura pública: o site carrega a imagem direto da URL.
// Variáveis NEON_STORAGE_* (a Vercel reserva os nomes AWS_*).

// O admin já comprime a foto no navegador para até 500 KB (MarmitaForm).
export const MAX_IMAGE_BYTES = 600 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export interface ParsedDataUrl {
  mime: string;
  extension: string;
  bytes: Buffer;
}

export function isDataImageUrl(value: unknown): boolean {
  return typeof value === 'string' && /^data:image\//i.test(value.trim());
}

export function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());

  if (!match) {
    throw new ApiError(400, 'Imagem inválida.');
  }

  const mime = match[1].toLowerCase();
  const extension = EXTENSION_BY_MIME[mime];

  if (!extension) {
    throw new ApiError(400, 'Use uma imagem WEBP, JPG ou PNG.');
  }

  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.length === 0) {
    throw new ApiError(400, 'Imagem vazia.');
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'A imagem deve ter no máximo 600 KB.');
  }

  return { mime, extension, bytes };
}

export function buildProductImageKey(produtoId: string, extension: string, now = Date.now()) {
  const safeId = produtoId.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return `${safeId}/${now}.${extension}`;
}

function getStorageConfig() {
  return {
    endpoint: requireEnv('NEON_STORAGE_ENDPOINT').replace(/\/$/, ''),
    region: requireEnv('NEON_STORAGE_REGION'),
    bucket: requireEnv('NEON_STORAGE_BUCKET'),
    accessKeyId: requireEnv('NEON_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('NEON_STORAGE_SECRET_ACCESS_KEY'),
  };
}

// Bucket public_read: https://<endpoint>/<bucket>/<key>
export function buildPublicUrl(endpoint: string, bucket: string, key: string) {
  return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
}

let client: S3Client | null = null;

function getClient() {
  const config = getStorageConfig();

  client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });

  return { client, config };
}

export async function putProductImage(dataUrl: string, produtoId: string) {
  const image = parseImageDataUrl(dataUrl);
  const { client: s3, config } = getClient();
  const key = buildProductImageKey(produtoId, image.extension);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: image.bytes,
      ContentType: image.mime,
      // A chave muda a cada upload, então a foto pode ficar em cache "para sempre".
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { key, url: buildPublicUrl(config.endpoint, config.bucket, key) };
}

// Apagar a foto antiga não deve derrubar o salvamento do produto.
export async function deleteProductImage(key: string | null | undefined) {
  if (!key) {
    return;
  }

  try {
    const { client: s3, config } = getClient();
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    console.warn(`Não foi possível apagar a imagem ${key}:`, error);
  }
}
