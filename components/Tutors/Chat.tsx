import { useEffect, useRef, useState, useCallback } from 'react';
import {
  fetchMatchContext,
  fetchMessages,
  sendMessage,
  acceptMatch,
  declineMatch,
  confirmSessionDate,
  whatsappLink,
  DECLINE_REASONS,
  MatchContext,
} from '../../lib/matches';
import { ChatMessage } from '../../lib/supabase';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type ChatProps = {
  matchId: string;
  currentUserId: string;
  viewerRole: 'parent' | 'tutor';
};

// Polling, not Supabase Realtime -- no other part of this codebase uses
// Realtime yet (NotificationBell also just fetches-on-open), and a 5s
// refresh is plenty responsive for a booking negotiation chat without
// introducing a new websocket-subscription pattern for this one feature.
const POLL_INTERVAL_MS = 5000;

// DECLINE_REASONS' underlying values (lib/matches.ts) are stored/compared
// as-is regardless of locale -- only the displayed label translates, same
// "translate the label, not the underlying value" pattern used for
// course.level and QuizBuilder's True/False options.
const DECLINE_REASON_KEYS: Record<string, TranslationKey> = {
  'Trop loin': 'tutorMarketplace.chat.declineReason.tooFar',
  "Conflit d'horaire": 'tutorMarketplace.chat.declineReason.scheduleConflict',
  'Pas ma matière': 'tutorMarketplace.chat.declineReason.notMySubject',
  Autre: 'tutorMarketplace.chat.declineReason.other',
};

type PendingMessage = { tempId: string; body: string; failed: boolean };

// Design Review wireframe Screen 4: ~/.gstack/projects/Lucienengolo-SLearn/
// designs/tutor-mvp-screens-20260721/wireframe.html
export default function Chat({ matchId, currentUserId, viewerRole }: ChatProps) {
  const { t } = useLocale();
  const [context, setContext] = useState<MatchContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState('');
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [sessionDateInput, setSessionDateInput] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    try {
      setContext(await fetchMatchContext(matchId));
    } catch {
      setLoadError(t('tutorMarketplace.chat.errorLoadConversation'));
    }
  }, [matchId, t]);

  const loadMessages = useCallback(async () => {
    try {
      setMessages(await fetchMessages(matchId));
    } catch {
      // Non-critical on a background poll -- keep showing the last known
      // messages rather than clearing the screen on a transient failure.
    }
  }, [matchId]);

  useEffect(() => {
    loadContext();
    loadMessages();
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadContext, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function attemptSend(body: string, tempId: string) {
    try {
      await sendMessage(matchId, currentUserId, body);
      setPending(null);
      loadMessages();
    } catch {
      setPending({ tempId, body, failed: true });
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = composerText.trim();
    if (!body || pending) return;
    setComposerText('');
    const tempId = `temp-${Date.now()}`;
    setPending({ tempId, body, failed: false });
    attemptSend(body, tempId);
  }

  function handleRetry() {
    if (!pending) return;
    setPending({ ...pending, failed: false });
    attemptSend(pending.body, pending.tempId);
  }

  async function handleAccept() {
    setActionError('');
    try {
      await acceptMatch(matchId);
      loadContext();
    } catch {
      setActionError(t('tutorMarketplace.chat.errorAccept'));
    }
  }

  async function handleDecline(reason?: (typeof DECLINE_REASONS)[number]) {
    setActionError('');
    try {
      await declineMatch(matchId, reason);
      loadContext();
    } catch {
      setActionError(t('tutorMarketplace.chat.errorDecline'));
    }
  }

  async function handleConfirmDate(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionDateInput) return;
    setActionError('');
    try {
      await confirmSessionDate(matchId, new Date(sessionDateInput));
      loadContext();
    } catch {
      setActionError(t('tutorMarketplace.chat.errorConfirmDate'));
    }
  }

  if (loadError) {
    return <p className="text-sm text-oxblood font-medium">{loadError}</p>;
  }
  if (!context) {
    return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;
  }

  const { match, request, tutorProfile } = context;
  const counterpartWhatsapp = viewerRole === 'parent' ? context.tutorFields.whatsapp_contact : request.whatsapp_contact;
  const isTutorAwaitingResponse = viewerRole === 'tutor' && match.status === 'matched';

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-4 sm:p-6 max-w-[600px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-4">
        {viewerRole === 'parent' ? `${t('tutorMarketplace.chat.discussionWithPrefix')} ${tutorProfile.full_name ?? t('tutorMarketplace.chat.yourTutorFallback')}` : t('tutorMarketplace.chat.discussionTitle')}
      </h1>

      {isTutorAwaitingResponse ? (
        <div className="border border-ink-border rounded-lg p-3 sm:p-4 mb-4">
          <p className="text-sm mb-3">
            {t('tutorMarketplace.chat.requestLabel')} {request.grade}, {request.neighborhood}
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleAccept}
              className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {t('tutorMarketplace.chat.accept')}
            </button>
            <button
              onClick={() => handleDecline()}
              className="min-h-11 px-4 border border-oxblood text-oxblood hover:bg-oxblood hover:text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {t('tutorMarketplace.chat.decline')}
            </button>
          </div>
          <p className="text-[12px] text-warm-gray mb-1.5">{t('tutorMarketplace.chat.declineReasonPrompt')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleDecline(reason)}
                className="min-h-8 text-[12px] px-3 py-1.5 border border-ink-border rounded-full bg-white hover:border-warm-gray"
              >
                {t(DECLINE_REASON_KEYS[reason])}
              </button>
            ))}
          </div>
          {actionError && <p className="text-[12px] text-oxblood font-medium mt-2">{actionError}</p>}
        </div>
      ) : (
        <>
          <div className="bg-white border border-ink-border rounded-lg p-3 mb-4 max-h-[360px] overflow-y-auto">
            {messages.length === 0 && !pending ? (
              <p className="text-sm text-warm-gray text-center py-6">
                {t('tutorMarketplace.chat.emptyMessagesPrompt')}
              </p>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={`flex mb-2.5 ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] px-3.5 py-2 rounded-xl text-sm ${
                        m.sender_id === currentUserId ? 'bg-ink text-paper' : 'bg-[#F2EEE2] border border-ink-border'
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
                {pending && (
                  <div className="flex justify-end mb-2.5">
                    <div className="max-w-[70%]">
                      <div className={`px-3.5 py-2 rounded-xl text-sm bg-ink text-paper ${pending.failed ? 'opacity-50' : ''}`}>
                        {pending.body}
                      </div>
                      {pending.failed && (
                        <div className="flex items-center gap-1.5 justify-end mt-1">
                          <span className="text-[11px] text-oxblood">{t('tutorMarketplace.chat.sendFailedNote')}</span>
                          <button onClick={handleRetry} className="text-[11px] px-2 py-0.5 border border-ink-border rounded-full">
                            {t('tutorMarketplace.chat.retry')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {match.status === 'messaging' && !match.confirmed_session_date && (
            <form
              onSubmit={handleConfirmDate}
              className="border border-forest/30 bg-[#EAF1EE] rounded-lg p-3.5 mb-4"
            >
              <p className="text-sm font-semibold mb-2">{t('tutorMarketplace.chat.confirmSessionDateLabel')}</p>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={sessionDateInput}
                  onChange={(e) => setSessionDateInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-ink-border rounded-lg text-sm font-plex-mono"
                />
                <button
                  type="submit"
                  className="min-h-10 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  {t('tutorMarketplace.chat.confirmButton')}
                </button>
              </div>
              {actionError && <p className="text-[12px] text-oxblood font-medium mt-2">{actionError}</p>}
            </form>
          )}

          {match.confirmed_session_date && (
            <p className="text-[13px] text-forest font-medium mb-4">
              {t('tutorMarketplace.chat.sessionConfirmedPrefix')} {new Date(match.confirmed_session_date).toLocaleString('fr-FR')}
            </p>
          )}

          <form onSubmit={handleSend} className="flex gap-2 mb-2.5">
            <input
              type="text"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={t('tutorMarketplace.chat.messagePlaceholder')}
              className="flex-1 px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={!composerText.trim() || !!pending}
              className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {t('tutorMarketplace.chat.send')}
            </button>
          </form>
          <a
            href={whatsappLink(counterpartWhatsapp)}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 flex items-center justify-center whitespace-nowrap px-4 border border-ink-border rounded-lg text-sm font-medium hover:border-warm-gray transition-colors w-full"
          >
            {t('tutorMarketplace.chat.continueOnWhatsapp')}
          </a>
        </>
      )}
    </div>
  );
}
