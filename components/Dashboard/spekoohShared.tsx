import { Clock } from 'lucide-react';
import {
  SpekoohMarkingRequest,
  SpekoohMarkingRequestStatus,
  formatCountdown,
  isExpired,
  paperFacts,
  timeLeft,
} from '../../lib/spekoohMarkingRequests';
import type { TranslationKey } from '../../lib/i18n';

type Translate = (key: TranslationKey) => string;

const STATUS_LABEL_KEYS: Record<SpekoohMarkingRequestStatus, TranslationKey> = {
  pending: 'dashboard.marking.status.pending',
  accepted: 'dashboard.marking.status.accepted',
  rejected: 'dashboard.marking.status.rejected',
  submitted: 'dashboard.marking.status.submitted',
};

const STATUS_BADGE_CLASSES: Record<SpekoohMarkingRequestStatus, string> = {
  pending: 'bg-primary-50 text-primary-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
  submitted: 'bg-gray-100 text-gray-600',
};

// An unanswered request past its deadline is shown as Expired rather than
// still "Awaiting your response" -- it is not awaiting anything any more.
export function StatusBadge({ request, now, t }: { request: SpekoohMarkingRequest; now: Date; t: Translate }) {
  const expired = isExpired(request, now);
  return (
    <span
      className={`text-2xs font-semibold px-2 py-1 rounded-full ${
        expired ? 'bg-gray-100 text-gray-600' : STATUS_BADGE_CLASSES[request.status]
      }`}
    >
      {expired ? t('dashboard.marking.expiredBadge') : t(STATUS_LABEL_KEYS[request.status])}
    </span>
  );
}

export function FactChips({ request, t }: { request: SpekoohMarkingRequest; t: Translate }) {
  const facts = paperFacts(request);
  if (facts.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t('dashboard.marking.paperDetails')}>
      {facts.map((fact) => (
        <li key={fact} className="text-2xs font-medium px-2 py-1 rounded-[6px] bg-gray-100 text-gray-700">
          {fact}
        </li>
      ))}
    </ul>
  );
}

// Colour is never the only signal: the countdown text itself says "overdue"
// or shows the time remaining.
export function DeadlineChip({ deadline, now, t }: { deadline: string; now: Date; t: Translate }) {
  const left = timeLeft(deadline, now);
  const tone = left.overdue ? 'bg-red-50 text-red-600' : left.urgent ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-full ${tone}`}>
      <Clock size={11} />
      {formatCountdown(left, t)}
    </span>
  );
}
