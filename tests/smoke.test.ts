import { describe, expect, it } from 'vitest';

describe('testopzet', () => {
  it('heeft een IndexedDB beschikbaar', () => {
    expect(typeof indexedDB.open).toBe('function');
  });
});
