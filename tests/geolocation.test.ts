import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentLocation } from '../lib/geolocation';

describe('getCurrentLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with lat/lng on success', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({ coords: { latitude: 4.05, longitude: 9.7 } } as GeolocationPosition);
        },
      },
    });

    await expect(getCurrentLocation()).resolves.toEqual({ lat: 4.05, lng: 9.7 });
  });

  it('rejects with a friendly message when the browser denies/errors', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({} as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/impossible d'obtenir votre position/i);
  });

  it('rejects when the Geolocation API is not available on the device', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getCurrentLocation()).rejects.toThrow(/n'est pas disponible/i);
  });
});
