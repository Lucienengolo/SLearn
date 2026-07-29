export type Coordinates = { lat: number; lng: number };

// Promise wrapper around the callback-based Geolocation API so RequestForm
// can just await it. Real device location (founder request, 2026-07-29) --
// "point your location on Google Maps" -- not a typed address, so the
// matched instructor gets an unambiguous pin to navigate to.
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Impossible d'obtenir votre position. Vérifiez les autorisations de localisation.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
