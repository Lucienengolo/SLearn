import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectDefaultLocale, loadStoredLocale, storeLocale, translate } from '../lib/i18n';

describe('detectDefaultLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to French for a French browser locale', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectDefaultLocale()).toBe('fr');
  });

  it('detects English for an English browser locale', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(detectDefaultLocale()).toBe('en');
  });

  it('falls back to French (D10) for a locale that is neither', () => {
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(detectDefaultLocale()).toBe('fr');
  });
});

describe('locale persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been stored yet', () => {
    expect(loadStoredLocale()).toBeNull();
  });

  it('round-trips a stored locale', () => {
    storeLocale('en');
    expect(loadStoredLocale()).toBe('en');
  });

  it('ignores a corrupted/unexpected stored value', () => {
    localStorage.setItem('slearn_locale', 'de');
    expect(loadStoredLocale()).toBeNull();
  });
});

describe('translate', () => {
  it('returns the French string for a known key', () => {
    expect(translate('fr', 'nav.home')).toBe('Accueil');
  });

  it('returns the English string for the same key', () => {
    expect(translate('en', 'nav.home')).toBe('Home');
  });
});
