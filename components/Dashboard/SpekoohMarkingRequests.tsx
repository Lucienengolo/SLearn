import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, FileCheck, FileText } from 'lucide-react';
import {
  SpekoohMarkingRequest,
  SpekoohMarkingRequestStatus,
  fetchMyMarkingRequests,
  respondToMarkingRequest,
} from '../../lib/spekoohMarkingRequests';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';
import ConfirmDialog from '../UI/ConfirmDialog';
import SpekoohMarkingGuideForm from './SpekoohMarkingGuideForm';
import type { TranslationKey } from '../../lib/i18n';

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

function StatusBadge({ status, t }: { status: SpekoohMarkingRequestStatus; t: (key: TranslationKey) => string }) {
  return (
    <span className={`text-2xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE_CLASSES[status]}`}>
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

// Instructor-facing surface for the Spekooh↔S@Learn marking-request
// integration (see supabase/functions/spekooh-webhook, spekooh-respond).
// A new top-level tab in InstructorDashboard, not folded into S@Learn
// Classroom -- these are exam papers from an external partner platform, a
// different kind of work item from anything a course-teaching instructor
// manages there.
export default function SpekoohMarkingRequests() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<SpekoohMarkingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectPendingId, setRejectPendingId] = useState<number | null>(null);
  const [guideFormRequest, setGuideFormRequest] = useState<SpekoohMarkingRequest | null>(null);
  const [actingOnId, setActingOnId] = useState<number | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const result = await fetchMyMarkingRequests(user.id);
    setRequests(result);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (guideFormRequest) {
    return (
      <SpekoohMarkingGuideForm
        request={guideFormRequest}
        onBack={() => setGuideFormRequest(null)}
        onSubmitted={() => {
          setGuideFormRequest(null);
          load();
        }}
      />
    );
  }

  const handleAccept = async (request: SpekoohMarkingRequest) => {
    setActingOnId(request.spekooh_request_id);
    try {
      await respondToMarkingRequest(request.spekooh_request_id, 'ACCEPTED');
      showToast(t('dashboard.marking.acceptedToast'), 'success');
      load();
    } catch {
      showToast(t('dashboard.marking.actionFailedToast'), 'error');
    } finally {
      setActingOnId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (rejectPendingId === null) return;
    const spekoohRequestId = rejectPendingId;
    setRejectPendingId(null);
    setActingOnId(spekoohRequestId);
    try {
      await respondToMarkingRequest(spekoohRequestId, 'REJECTED');
      showToast(t('dashboard.marking.rejectedToast'), 'success');
      load();
    } catch {
      showToast(t('dashboard.marking.actionFailedToast'), 'error');
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.marking.title')}</h1>
      <p className="text-gray-500 mb-8">{t('dashboard.marking.subtitle')}</p>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('dashboard.marking.emptyTitle')}</h3>
          <p className="text-gray-500 text-sm">{t('dashboard.marking.emptyBody')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isActing = actingOnId === request.spekooh_request_id;
            return (
              <div key={request.id} className="rounded-[14px] border border-canvas-150 p-5">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">{request.subject ?? '—'}</h3>
                    <StatusBadge status={request.status} t={t} />
                  </div>
                  <span className="text-2xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {t('dashboard.marking.sentPrefix')} {new Date(request.sent_at).toLocaleDateString()}
                  </span>
                </div>

                {request.status === 'pending' && request.responds_by && (
                  <p className="text-sm text-gray-500 mb-3">
                    {t('dashboard.marking.respondByPrefix')} {new Date(request.responds_by).toLocaleString()}
                  </p>
                )}
                {(request.status === 'accepted' || request.status === 'submitted') && request.guide_deadline && (
                  <p className="text-sm text-gray-500 mb-3">
                    {t('dashboard.marking.guideDeadlinePrefix')} {new Date(request.guide_deadline).toLocaleString()}
                  </p>
                )}

                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(request)}
                      disabled={isActing}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary-500 text-gray-900 h-10 px-5 rounded-[10px] hover:bg-primary-400 transition font-medium disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} />
                      <span>{t('dashboard.marking.accept')}</span>
                    </button>
                    <button
                      onClick={() => setRejectPendingId(request.spekooh_request_id)}
                      disabled={isActing}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-50 text-red-600 h-10 px-5 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      <span>{t('dashboard.marking.reject')}</span>
                    </button>
                  </div>
                )}

                {request.status === 'accepted' && (
                  <button
                    onClick={() => setGuideFormRequest(request)}
                    className="flex items-center justify-center gap-1.5 bg-primary-500 text-gray-900 h-10 px-5 rounded-[10px] hover:bg-primary-400 transition font-medium"
                  >
                    <FileCheck size={15} />
                    <span>{t('dashboard.marking.writeGuide')}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={rejectPendingId !== null}
        title={t('dashboard.marking.rejectConfirmTitle')}
        message={t('dashboard.marking.rejectConfirmMessage')}
        confirmLabel={t('dashboard.marking.reject')}
        destructive
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectPendingId(null)}
      />
    </div>
  );
}
