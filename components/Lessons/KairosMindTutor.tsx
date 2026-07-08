import { useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { KairosMindMessage, KairosMindMode, streamKairosMindReply } from '../../lib/kairosMind';

type KairosMindTutorProps = {
  lessonId: string;
};

const MODES: { value: KairosMindMode; label: string }[] = [
  { value: 'explain', label: 'Explain' },
  { value: 'quiz', label: 'Quiz me' },
  { value: 'translate', label: 'Translate' },
];

// Docked panel, always visible (not a collapsible card) -- matches the
// "Aria" panel in improved/04 Lesson Viewer.dc.html, which turned out to
// be exactly this real feature's original mockup name.
export default function KairosMindTutor({ lessonId }: KairosMindTutorProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<KairosMindMode>('explain');
  const [targetLanguage, setTargetLanguage] = useState('French');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<KairosMindMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
    setInput('');
    setSending(true);
    setError('');

    try {
      let assistantText = '';
      await streamKairosMindReply(
        {
          lessonId,
          mode,
          message: trimmed,
          targetLanguage: mode === 'translate' ? targetLanguage : undefined,
          history,
        },
        (token) => {
          assistantText += token;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: assistantText };
            return next;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kairos Mind is unavailable right now.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-canvas-150 flex items-center gap-2.5 flex-shrink-0">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#E2A52A,#A66E13)' }}
        >
          <Sparkles size={16} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-gray-900">Kairos Mind</div>
          <div className="text-2xs text-green-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Your learning assistant
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 flex gap-1.5 flex-shrink-0">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`text-2xs px-2.5 py-1 rounded-full transition font-medium ${
              mode === m.value ? 'bg-primary-500 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'translate' && (
        <div className="px-3 pt-2 flex-shrink-0">
          <input
            type="text"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder="Target language"
            aria-label="Target language"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {!user ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-gray-500">
          Sign in to ask Kairos Mind, your AI tutor for this lesson.
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
            {messages.length === 0 && (
              <>
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-[4px_14px_14px_14px] bg-primary-50 border border-primary-200 text-sm text-gray-800">
                  Hi! I'm Kairos Mind. I can explain anything in this lesson, quiz you, or translate it. What would you
                  like?
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  {(
                    [
                      ['Explain this simply', 'explain'],
                      ['Quiz me on this lesson', 'quiz'],
                      ['Summarize in French', 'translate'],
                    ] as [string, KairosMindMode][]
                  ).map(([label, suggestedMode]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setMode(suggestedMode);
                        handleSend(label);
                      }}
                      className="text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-[10px] px-3 py-2 hover:border-primary-300 hover:bg-primary-50 transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-gray-900 text-white rounded-[14px_4px_14px_14px]'
                      : 'bg-primary-50 border border-primary-200 text-gray-900 rounded-[4px_14px_14px_14px]'
                  }`}
                >
                  {m.content || (sending && i === messages.length - 1 ? '…' : '')}
                </div>
              </div>
            ))}
            {error && <div className="bg-red-50 text-red-600 p-2 rounded-[10px] text-sm">{error}</div>}
          </div>

          <div className="p-3.5 border-t border-canvas-150 flex-shrink-0">
            <div className="flex items-center gap-2 border border-gray-300 rounded-full pl-4 pr-1.5 py-1.5">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={mode === 'quiz' ? 'Type your answer, or "start"' : 'Ask about this lesson…'}
                aria-label="Message to Kairos Mind"
                disabled={sending}
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-full bg-primary-500 text-gray-900 hover:bg-primary-400 transition disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-center text-2xs text-gray-400 mt-2">Kairos Mind can make mistakes — check important info</p>
          </div>
        </>
      )}
    </div>
  );
}
