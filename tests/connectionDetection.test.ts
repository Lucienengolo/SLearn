import { describe, it, expect } from 'vitest';
import { isSlowConnection } from '../lib/connectionDetection';

describe('isSlowConnection', () => {
  it('is not slow when the NetworkInformation API is unsupported (Safari/Firefox)', () => {
    expect(isSlowConnection(undefined)).toBe(false);
  });

  it('treats slow-2g as slow', () => {
    expect(isSlowConnection({ effectiveType: 'slow-2g' })).toBe(true);
  });

  it('treats 2g as slow', () => {
    expect(isSlowConnection({ effectiveType: '2g' })).toBe(true);
  });

  it('does not treat 3g as slow', () => {
    expect(isSlowConnection({ effectiveType: '3g' })).toBe(false);
  });

  it('does not treat 4g as slow', () => {
    expect(isSlowConnection({ effectiveType: '4g' })).toBe(false);
  });

  it('treats the user\'s own data-saver preference as slow regardless of effectiveType', () => {
    expect(isSlowConnection({ effectiveType: '4g', saveData: true })).toBe(true);
  });
});
