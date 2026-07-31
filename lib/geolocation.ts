export type Coordinates = { lat: number; lng: number };

// Distinguishing the 3 GeolocationPositionError codes matters in practice --
// a founder report of "location is on but sharing still fails" turned out to
// be indistinguishable, in the old single generic message, from a genuine
// permission block vs. a slow GPS fix timing out vs. an in-app browser
// (WhatsApp/Torch-style webviews frequently restrict or silently deny the
// permission prompt entirely) that never surfaces the OS permission dialog
// at all. Each code gets its own actionable message instead.
// Numeric literals (the standard's own PERMISSION_DENIED=1/POSITION_UNAVAILABLE=2/
// TIMEOUT=3), not error.PERMISSION_DENIED etc. -- those are instance getters
// that a partial/mocked error object (or some older WebViews) may not
// define, which would make `error.code === error.PERMISSION_DENIED` compare
// undefined to undefined and silently match the wrong case.
// permissionState comes from the Permissions API, queried *before* calling
// getCurrentPosition -- a founder screenshot showed Chrome's own per-site
// "Location" toggle already ON, yet code 1 (PERMISSION_DENIED) still fired.
// Telling that user to "allow location for this site in your browser
// settings" is actively wrong when the site-level permission is already
// granted -- the real block in that case is one level up, at the OS/device
// location-services toggle (common on Chromebooks and desktop OSes with
// location services disabled system-wide), which the site-permission
// message can't fix. Distinguishing "site already granted" lets us point at
// the right settings screen instead of sending the user back to a toggle
// that's already correct.
function messageForGeolocationError(error: GeolocationPositionError, permissionState: PermissionState | null = null): string {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      if (permissionState === 'granted') {
        return "Ce site est déjà autorisé à accéder à la position, mais votre appareil bloque la localisation au niveau système. Activez le service de localisation dans les réglages de votre appareil (ex. sur Chromebook : Réglages rapides > Position), puis réessayez.";
      }
      return "Localisation refusée. Autorisez l'accès à la position pour ce site dans les réglages de votre navigateur, puis réessayez. Si vous êtes dans l'appli WhatsApp, ouvrez la page dans votre navigateur (Chrome/Safari) plutôt que dans l'aperçu intégré.";
    case 2: // POSITION_UNAVAILABLE
      return "Votre position n'a pas pu être déterminée. Vérifiez que la localisation est bien activée sur votre appareil, puis réessayez.";
    case 3: // TIMEOUT
      return "La recherche de votre position a pris trop de temps. Réessayez, idéalement avec un signal GPS ou Wi-Fi plus stable.";
    default:
      return "Impossible d'obtenir votre position. Vérifiez les autorisations de localisation.";
  }
}

// Promise wrapper around the callback-based Geolocation API so RequestForm
// can just await it. Real device location (founder request, 2026-07-29) --
// "point your location on Google Maps" -- not a typed address, so the
// matched instructor gets an unambiguous pin to navigate to.
export async function getCurrentLocation(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    throw new Error("La géolocalisation n'est pas disponible sur cet appareil.");
  }

  // Best-effort: not every browser implements the Permissions API (older
  // Safari), so a missing/throwing query just leaves this null and
  // messageForGeolocationError falls back to its original site-permission
  // wording.
  let permissionState: PermissionState | null = null;
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    permissionState = status?.state ?? null;
  } catch {
    permissionState = null;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(messageForGeolocationError(error, permissionState))),
      // A generous timeout + maximumAge: a cold GPS fix can genuinely take
      // several seconds, and the previous 10s timeout with no cached-fix
      // allowance meant a slow-but-working fix looked identical to a
      // permission failure.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  });
}
