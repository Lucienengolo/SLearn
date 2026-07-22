// Pure detection logic (framework-agnostic, testable) for CEO plan item 8:
// "detect slow connection, offer audio-only/PDF fallback, no transcoding
// pipeline." Deliberately NOT real adaptive bitrate streaming -- that's a
// separate infrastructure initiative (see TODOS.md's low-bandwidth-mode
// note). This only decides whether to default to the lightweight path;
// getNetworkInfo() is the thin, untestable wrapper around the real
// (Chromium-only) NetworkInformation API.
export type NetworkInfo = { effectiveType?: string; saveData?: boolean } | undefined;

export function isSlowConnection(network: NetworkInfo): boolean {
  // API unsupported (Safari/Firefox as of this writing) -- default to NOT
  // forcing low-bandwidth mode. The user can still opt in manually via the
  // toggle; we just can't auto-detect for them on those browsers.
  if (!network) return false;
  if (network.saveData) return true;
  return network.effectiveType === 'slow-2g' || network.effectiveType === '2g';
}

export function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInfo }).connection;
}
