import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MarkingGuideQuestion, SpekoohMarkingRequest, submitMarkingGuide } from '../../lib/spekoohMarkingRequests';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type SpekoohMarkingGuideFormProps = {
  request: SpekoohMarkingRequest;
  onBack: () => void;
  onSubmitted: () => void;
};

const QUESTION_TYPE_KEYS: Record<MarkingGuideQuestion['question_type'], TranslationKey> = {
  SHORT_ANSWER: 'dashboard.marking.questionType.shortAnswer',
  CALCULATION: 'dashboard.marking.questionType.calculation',
  ESSAY: 'dashboard.marking.questionType.essay',
};

function emptyQuestion(): MarkingGuideQuestion {
  return { question_type: 'SHORT_ANSWER', text: '', answer: '' };
}

// Full-page drill-in, matching GradingPanel's established pattern for
// anything more complex than a single-field form (rather than a modal).
export default function SpekoohMarkingGuideForm({ request, onBack, onSubmitted }: SpekoohMarkingGuideFormProps) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<MarkingGuideQuestion[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);

  const updateQuestion = (index: number, patch: Partial<MarkingGuideQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (questions.length === 0) {
      showToast(t('dashboard.marking.needsAtLeastOneQuestion'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitMarkingGuide(request.spekooh_request_id, questions);
      showToast(t('dashboard.marking.guideSubmittedToast'), 'success');
      onSubmitted();
    } catch {
      showToast(t('dashboard.marking.guideSubmitFailedToast'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4">
        ← {t('dashboard.marking.backToRequests')}
      </button>
      <h2 className="font-display text-2xl text-gray-900 mb-1">{request.subject ?? t('dashboard.marking.title')}</h2>
      <p className="text-gray-500 mb-6">{t('dashboard.marking.guideFormSubtitle')}</p>

      <div className="space-y-3 mb-4">
        {questions.map((question, index) => (
          <div key={index} className="rounded-[10px] border border-canvas-150 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="font-medium text-gray-900 text-sm">
                {t('dashboard.marking.questionNumberPrefix')} {index + 1}
              </span>
              <button
                onClick={() => removeQuestion(index)}
                className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-[8px] hover:bg-red-100 transition"
                title={t('dashboard.marking.removeQuestion')}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              <select
                value={question.question_type}
                onChange={(e) => updateQuestion(index, { question_type: e.target.value as MarkingGuideQuestion['question_type'] })}
                className="h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 sm:w-56"
              >
                {(Object.keys(QUESTION_TYPE_KEYS) as MarkingGuideQuestion['question_type'][]).map((qType) => (
                  <option key={qType} value={qType}>
                    {t(QUESTION_TYPE_KEYS[qType])}
                  </option>
                ))}
              </select>
              <input
                value={question.text}
                onChange={(e) => updateQuestion(index, { text: e.target.value })}
                placeholder={t('dashboard.marking.questionTextPlaceholder')}
                className="h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <input
                value={question.answer}
                onChange={(e) => updateQuestion(index, { answer: e.target.value })}
                placeholder={t('dashboard.marking.answerPlaceholder')}
                className="h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
        className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 transition mb-6"
      >
        <Plus size={15} />
        <span>{t('dashboard.marking.addQuestion')}</span>
      </button>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full sm:w-auto bg-primary-500 text-gray-900 h-11 px-6 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
      >
        {t('dashboard.marking.submitGuideButton')}
      </button>
    </div>
  );
}
