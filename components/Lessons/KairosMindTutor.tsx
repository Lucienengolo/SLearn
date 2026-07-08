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

export default function KairosMindTutor({ lessonId }: KairosMindTutorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<KairosMindMode>('explain');
  const [targetLanguage, setTargetLanguage] = useState('French');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<KairosMindMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!user) {
    return (
      <div className="mt-6 bg-white rounded-lg shadow p-4 flex items-center gap-3 text-sm text-gray-600">
        <Sparkles size={18} className="text-primary-600" />
        Sign in to ask Kairos Mind, your AI tutor for this lesson.
      </div>
    );
  }

  const handleSend = async () => {
    const trimmed = input.trim();
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
    <div className="mt-6 bg-white rounded-lg shadow">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2 font-semibold text-gray-800">
          <Sparkles size={18} className="text-primary-600" />
          Ask Kairos Mind
        </span>
        <span className="text-sm text-gray-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`text-sm px-3 py-1.5 rounded-full transition ${
                  mode === m.value ? 'bg-primary-500 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'translate' && (
            <input
              type="text"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="Target language"
              aria-label="Target language"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          )}

          <div ref={scrollRef} className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                {mode === 'quiz'
                  ? 'Ask Kairos Mind to quiz you on this lesson.'
                  : mode === 'translate'
                  ? 'Send a message or the lesson content to translate.'
                  : 'Ask a question about this lesson.'}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm p-3 rounded-lg whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary-50 text-gray-800 ml-8' : 'bg-gray-50 text-gray-800 mr-8'
                }`}
              >
                {m.content || (sending && i === messages.length - 1 ? '…' : '')}
              </div>
            ))}
          </div>

          {error && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={mode === 'quiz' ? 'Type your answer, or "start" for a question' : 'Type a message'}
              aria-label="Message to Kairos Mind"
              disabled={sending}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="bg-primary-500 text-gray-900 px-4 py-3.5 rounded-lg hover:bg-primary-400 transition disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
