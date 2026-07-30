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

  it('rejects with a generic fallback message for an unrecognized error code', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({} as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/impossible d'obtenir votre position/i);
  });

  it('rejects with a specific message when permission is denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1 } as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/localisation refusée/i);
  });

  it('rejects with a specific message when the position is unavailable', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 2 } as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/n'a pas pu être déterminée/i);
  });

  it('rejects with a specific message on timeout', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 3 } as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(/a pris trop de temps/i);
  });

  it('rejects when the Geolocation API is not available on the device', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getCurrentLocation()).rejects.toThrow(/n'est pas disponible/i);
  });
});
