export interface CatalogImageSources {
  src: string;
  srcSet?: string;
  sizes?: string;
}

function normalizePublicPath(value: string) {
  return value.trim().replace(/\\/g, '/');
}

function isExternalOrDataImage(value: string) {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

function getPublicMenuBaseName(imageKey: string) {
  const normalizedPath = normalizePublicPath(imageKey);
  const filename = normalizedPath.split('/').pop() ?? normalizedPath;
  return slugify(filename.replace(/\.[a-z0-9]+$/i, ''));
}

function repairMojibake(value: string) {
  return value
    .replace(/\u00c3\u0192\u00c2\u00a0/g, 'a')
    .replace(/\u00c3\u0192\u00c2\u00a1/g, 'a')
    .replace(/\u00c3\u0192\u00c2\u00a2/g, 'a')
    .replace(/\u00c3\u0192\u00c2\u00a3/g, 'a')
    .replace(/\u00c3\u0192\u00c2\u00a7/g, 'c')
    .replace(/\u00c3\u0192\u00c2\u00a9/g, 'e')
    .replace(/\u00c3\u0192\u00c2\u00aa/g, 'e')
    .replace(/\u00c3\u0192\u00c2\u00ad/g, 'i')
    .replace(/\u00c3\u0192\u00c2\u00b3/g, 'o')
    .replace(/\u00c3\u0192\u00c2\u00b4/g, 'o')
    .replace(/\u00c3\u0192\u00c2\u00b5/g, 'o')
    .replace(/\u00c3\u0192\u00c2\u00ba/g, 'u')
    .replace(/\u00c3\u00a0/g, 'a')
    .replace(/\u00c3\u00a1/g, 'a')
    .replace(/\u00c3\u00a2/g, 'a')
    .replace(/\u00c3\u00a3/g, 'a')
    .replace(/\u00c3\u00a7/g, 'c')
    .replace(/\u00c3\u00a9/g, 'e')
    .replace(/\u00c3\u00aa/g, 'e')
    .replace(/\u00c3\u00ad/g, 'i')
    .replace(/\u00c3\u00b3/g, 'o')
    .replace(/\u00c3\u00b4/g, 'o')
    .replace(/\u00c3\u00b5/g, 'o')
    .replace(/\u00c3\u00ba/g, 'u');
}

function slugify(value: string) {
  return repairMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCatalogImageSources(imageKey: string | null | undefined): CatalogImageSources | null {
  if (!imageKey?.trim()) {
    return null;
  }

  const trimmedValue = imageKey.trim();

  if (isExternalOrDataImage(trimmedValue)) {
    return { src: trimmedValue };
  }

  const baseName = getPublicMenuBaseName(trimmedValue);
  const optimized400 = `/menu/${baseName}-400.webp`;
  const optimized800 = `/menu/${baseName}-800.webp`;

  return {
    src: optimized400,
    srcSet: `${optimized400} 400w, ${optimized800} 800w`,
    sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 44vw, 320px',
  };
}

export function getCatalogImageSrc(imageKey: string | null | undefined) {
  return getCatalogImageSources(imageKey)?.src ?? null;
}

export function hasLegacyCatalogImageUrl(imageKey: string | null | undefined) {
  return !!imageKey && /^https?:\/\//i.test(imageKey.trim());
}

export function hasDatabaseCatalogImage(imageKey: string | null | undefined) {
  return !!imageKey && /^data:image\//i.test(imageKey.trim());
}

export function getCatalogImageOptions() {
  return [];
}

export function getCatalogImageOption() {
  return null;
}

export function getSuggestedCatalogImage() {
  return null;
}

export function getCatalogImageMigrationStatus({
  imageKey,
}: {
  productName?: string | null;
  imageKey?: string | null;
}) {
  if (hasDatabaseCatalogImage(imageKey)) return 'database';
  if (imageKey) return 'local';
  return 'missing';
}
