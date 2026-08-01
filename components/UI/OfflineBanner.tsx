import { WifiOff } from 'lucide-react';
import { useOfflineStatus } from '../../contexts/OfflineContext';
import { useLocale } from '../../contexts/LocaleContext';

// Only shows when the user has opted into offline mode AND the browser is
// actually offline -- someone who never turned this on sees no change at
// all when their connection drops (founder request, 2026-08-01).
export default function OfflineBanner() {
  const { isOnline, offlineModeEnabled } = useOfflineStatus();
  const { t } = useLocale();

  if (isOnline || !offlineModeEnabled) return null;

  return (
    <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 justify-center text-sm text-amber-800">
      <WifiOff size={16} className="flex-shrink-0" />
      <span>{t('offline.bannerMessage')}</span>
    </div>
  );
}
