import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, FileCheck, XCircle } from 'lucide-react';
import {
  MAX_DECLINE_REASON_LENGTH,
  SpekoohMarkingRequest,
  activeDeadline,
  isExpired,
  paperTitle,
  respondToMarkingRequest,
} from '../../lib/spekoohMarkingRequests';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';
import SpekoohMarkingGuideForm from './SpekoohMarkingGuideForm';
import SpekoohPaperViewer from './SpekoohPaperViewer';
import { DeadlineChip, FactChips, StatusBadge } from './spekoohShared';

type Props = {
  request: SpekoohMarkingRequest;
  now: Date;
  onBack: () => void;
  onChanged: () => void;
  onViewEarnings: () => void;
};

type TimelineStep = { key: string; label: TranslationKey; at: string | null; done: boolean; note?: string };

// What has happened to this request, and what is still ahead. Steps that
// have not happened yet are shown as pending, not hidden, so the instructor
// can see what comes next.
function buildTimeline(request: SpekoohMarkingRequest, now: Date): TimelineStep[] {
  const steps: TimelineStep[] = [{ key: 'received', label: 'dashboard.marking.timeline.received', at: request.sent_at, done: true }];

  if (request.status === 'rejected') {
    steps.push({
      key: 'declined',
      label: 'dashboard.marking.timeline.declined',
      at: request.responded_at,
      done: true,
      note: request.decline_reason ?? undefined,
    });
    return steps;
  }
  if (isExpired(request, now)) {
    steps.push({ key: 'expired', label: 'dashboard.marking.timeline.expired', at: request.responds_by, done: true });
    return steps;
  }

  const accepted = request.status === 'accepted' || request.status === 'submitted';
  steps.push({ key: 'accepted', label: 'dashboard.marking.timeline.accepted', at: request.responded_at, done: accepted });
  steps.push({
    key: 'submitted',
    label: 'dashboard.marking.timeline.submitted',
    at: request.status === 'submitted' ? request.submitted_at : null,
    done: request.status === 'submitted',
  });
  return steps;
}

function Timeline({ request, now }: { request: SpekoohMarkingRequest; now: Date }) {
  const { t, locale } = useLocale();
  const steps = buildTimeline(request, now);
  return (
    <section aria-labelledby="progress-heading" className="rounded-[14px] border border-canvas-150 shadow-sm p-5 bg-white">
      <h2 id="progress-heading" className="text-sm font-semibold text-gray-900 mb-4">
        {t('dashboard.marking.progressHeading')}
      </h2>
      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.key} className="flex gap-3">
            {step.done ? (
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Circle size={18} className="text-gray-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-gray-900' : 'text-gray-500'}`}>{t(step.label)}</p>
              {step.at && (
                <p className="text-2xs text-gray-500">{new Date(step.at).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')}</p>
              )}
              {step.note && (
                <p className="text-sm text-gray-600 mt-1 break-words">
                  {t('dashboard.marking.declineReasonPrefix')} {step.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RejectDialog({ onCancel, onConfirm, busy }: { onCancel: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const { t } = useLocale();
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-[14px] max-w-md w-full p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
      >
        <h3 id="reject-dialog-title" className="text-lg font-semibold text-gray-900 mb-1">
          {t('dashboard.marking.rejectConfirmTitle')}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{t('dashboard.marking.rejectConfirmMessage')}</p>
        <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-900 mb-1.5">
          {t('dashboard.marking.declineReasonLabel')}
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          maxLength={MAX_DECLINE_REASON_LENGTH}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('dashboard.marking.declineReasonPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-5"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-10 px-4 rounded-[10px] border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {t('dashboard.marking.cancel')}
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy}
            className="h-10 px-4 rounded-[10px] bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {t('dashboard.marking.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmittedSummary({ request, onViewEarnings }: { request: SpekoohMarkingRequest; onViewEarnings: () => void }) {
  const { t } = useLocale();
  const answers = request.content ?? [];
  const hasText = answers.some((question) => question.text || question.answer);
  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">{t('dashboard.marking.submittedBody')}</p>
      {request.guide_storage_path && <p className="text-sm text-gray-700 mb-4">{t('dashboard.marking.submittedFileNotice')}</p>}
      {hasText && (
        <>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('dashboard.marking.submittedAnswersHeading')}</h3>
          <ol className="space-y-2 mb-4 list-decimal list-inside">
            {answers.map((question, index) => (
              <li key={index} className="text-sm text-gray-700">
                {question.text && <span className="font-medium">{question.text} </span>}
                <span className="text-gray-600 break-words">{question.answer}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <button onClick={onViewEarnings} className="text-sm font-semibold text-primary-700 hover:text-primary-800 transition">
        {t('dashboard.marking.viewEarnings')} →
      </button>
    </div>
  );
}

// One request, in full: what the paper is, the paper itself, where the
// request stands, and whatever the instructor can do next about it.
export default function SpekoohRequestDetail({ request, now, onBack, onChanged, onViewEarnings }: Props) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const deadline = activeDeadline(request);
  const expired = isExpired(request, now);

  const respond = async (decision: 'ACCEPTED' | 'REJECTED', reason?: string) => {
    setActing(true);
    try {
      await respondToMarkingRequest(request.spekooh_request_id, decision, reason);
      showToast(t(decision === 'ACCEPTED' ? 'dashboard.marking.acceptedToast' : 'dashboard.marking.rejectedToast'), 'success');
      setShowReject(false);
      onChanged();
    } catch {
      showToast(t('dashboard.marking.actionFailedToast'), 'error');
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-4">
        <ArrowLeft size={15} />
        {t('dashboard.marking.backToRequests')}
      </button>

      <header className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h1 className="font-display text-2xl sm:text-3xl text-gray-900">{paperTitle(request) ?? t('dashboard.marking.title')}</h1>
          <StatusBadge request={request} now={now} t={t} />
          {deadline && !expired && <DeadlineChip deadline={deadline} now={now} t={t} />}
        </div>
        <FactChips request={request} t={t} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="lg:sticky lg:top-4">
          <SpekoohPaperViewer spekoohRequestId={request.spekooh_request_id} />
        </div>

        <div className="space-y-6">
          <Timeline request={request} now={now} />

          {request.status === 'pending' && !expired && (
            <section className="rounded-[14px] border border-canvas-150 shadow-sm p-5 bg-white">
              <p className="text-sm text-gray-600 mb-4">{t('dashboard.marking.acceptHelp')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => respond('ACCEPTED')}
                  disabled={acting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary-500 text-gray-900 h-10 px-5 rounded-[10px] hover:bg-primary-400 transition font-medium disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  <span>{t('dashboard.marking.accept')}</span>
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={acting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-50 text-red-600 h-10 px-5 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                >
                  <XCircle size={15} />
                  <span>{t('dashboard.marking.reject')}</span>
                </button>
              </div>
            </section>
          )}

          {expired && (
            <p role="status" className="rounded-[14px] bg-gray-100 text-gray-700 text-sm p-4">
              {t('dashboard.marking.expiredNotice')}
            </p>
          )}

          {request.status === 'accepted' && (
            <section className="rounded-[14px] border border-canvas-150 shadow-sm p-5 bg-white" aria-labelledby="guide-heading">
              <h2 id="guide-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
                <FileCheck size={16} className="text-primary-600" />
                {t('dashboard.marking.guidePanelTitle')}
              </h2>
              <SpekoohMarkingGuideForm request={request} onSubmitted={onChanged} />
            </section>
          )}

          {request.status === 'submitted' && (
            <section className="rounded-[14px] border border-canvas-150 shadow-sm p-5 bg-white">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('dashboard.marking.submittedPanelTitle')}</h2>
              <SubmittedSummary request={request} onViewEarnings={onViewEarnings} />
            </section>
          )}
        </div>
      </div>

      {showReject && <RejectDialog busy={acting} onCancel={() => setShowReject(false)} onConfirm={(reason) => respond('REJECTED', reason)} />}
    </div>
  );
}
