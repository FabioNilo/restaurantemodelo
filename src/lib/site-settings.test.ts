import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_SETTINGS, isDeliveryClosed } from './site-settings';

describe('isDeliveryClosed', () => {
  it('opens every day between 11:00 and 22:00 in Bahia time', () => {
    expect(isDeliveryClosed(DEFAULT_SITE_SETTINGS, new Date('2026-07-23T14:00:00.000Z'))).toBe(false);
    expect(isDeliveryClosed(DEFAULT_SITE_SETTINGS, new Date('2026-07-20T14:00:00.000Z'))).toBe(false);
  });

  it('closes outside configured hours', () => {
    expect(isDeliveryClosed(DEFAULT_SITE_SETTINGS, new Date('2026-07-23T13:30:00.000Z'))).toBe(true);
    expect(isDeliveryClosed(DEFAULT_SITE_SETTINGS, new Date('2026-07-24T01:30:00.000Z'))).toBe(true);
  });
});
