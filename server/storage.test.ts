// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from './http.js';
import { buildProductImageKey, buildPublicUrl, isDataImageUrl, MAX_IMAGE_BYTES, parseImageDataUrl } from './storage.js';

const toDataUrl = (mime: string, bytes: number) => `data:${mime};base64,${Buffer.alloc(bytes, 1).toString('base64')}`;

describe('storage helpers', () => {
  it('parses webp, jpeg and png data URLs', () => {
    expect(parseImageDataUrl(toDataUrl('image/webp', 10))).toMatchObject({ mime: 'image/webp', extension: 'webp' });
    expect(parseImageDataUrl(toDataUrl('image/jpeg', 10)).extension).toBe('jpg');
    expect(parseImageDataUrl(toDataUrl('image/png', 10)).bytes).toHaveLength(10);
  });

  it('rejects other formats, garbage and oversized images', () => {
    expect(() => parseImageDataUrl(toDataUrl('image/gif', 10))).toThrow('WEBP, JPG ou PNG');
    expect(() => parseImageDataUrl('data:image/png;base64,@@@')).toThrow(ApiError);
    expect(() => parseImageDataUrl(toDataUrl('image/webp', MAX_IMAGE_BYTES + 1))).toThrow('600 KB');
  });

  it('only treats data:image URLs as uploads', () => {
    expect(isDataImageUrl(toDataUrl('image/webp', 1))).toBe(true);
    expect(isDataImageUrl('https://br-x.storage.neon.tech/produtos/a/1.webp')).toBe(false);
    expect(isDataImageUrl(null)).toBe(false);
  });

  it('builds a unique object key per product and upload, and the public URL', () => {
    expect(buildProductImageKey('Bolo de Aipim!', 'webp', 123)).toBe('bolo-de-aipim-/123.webp');
    expect(buildPublicUrl('https://br-x.storage.neon.tech/', 'produtos', 'bolo/1.webp')).toBe(
      'https://br-x.storage.neon.tech/produtos/bolo/1.webp'
    );
  });
});
