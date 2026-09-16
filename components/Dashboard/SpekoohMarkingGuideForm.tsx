import { useState } from 'react';
import { Plus, Trash2, ExternalLink, Upload } from 'lucide-react';
import {
  MarkingGuideQuestion,
  MarkingGuideQuestionTally,
  SpekoohMarkingRequest,
  submitMarkingGuide,
  submitMarkingGuideFile,
  uploadGuideFile,
} from '../../lib/spekoohMarkingRequests';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type SpekoohMarkingGuideFormProps = {
  request: SpekoohMarkingRequest;
  onBack: () => void;
  onSubmitted: () => void;
};

type GuideMode = 'form' | 'file';

const QUESTION_TYPE_KEYS: Record<MarkingGuideQuestion['question_type'], TranslationKey> = {
  SHORT_ANSWER: 'dashboard.marking.questionType.shortAnswer',
  CALCULATION: 'dashboard.marking.questionType.calculation',
  ESSAY: 'dashboard.marking.questionType.essay',
};

function emptyQuestion(): MarkingGuideQuestion {
  return { question_type: 'SHORT_ANSWER', text: '', answer: '' };
}

function emptyTallyRow(): MarkingGuideQuestionTally & { count: number } {
  return { question_type: 'SHORT_ANSWER', count: 1 };
}

function ModeToggle({ mode, onChange, t }: { mode: GuideMode; onChange: (m: GuideMode) => void; t: (key: TranslationKey) => string }) {
  return (
    <div className="inline-flex rounded-[10px] border border-gray-200 p-1 mb-6">
      {(['form', 'file'] as GuideMode[]).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`h-9 px-4 rounded-[8px] text-sm font-medium transition ${
            mode === option ? 'bg-primary-500 text-gray-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {t(option === 'form' ? 'dashboard.marking.guideModeForm' : 'dashboard.marking.guideModeFile')}
        </button>
      ))}
    </div>
  );
}

// Full-page drill-in, matching GradingPanel's established pattern for
// anything more complex than a single-field form (rather than a modal).
export default function SpekoohMarkingGuideForm({ request, onBack, onSubmitted }: SpekoohMarkingGuideFormProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<GuideMode>('form');
  const [questions, setQuestions] = useState<MarkingGuideQuestion[]>([emptyQuestion()]);
  const [tallyRows, setTallyRows] = useState<(MarkingGuideQuestionTally & { count: number })[]>([emptyTallyRow()]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateQuestion = (index: number, patch: Partial<MarkingGuideQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTallyRow = (index: number, patch: Partial<MarkingGuideQuestionTally & { count: number }>) => {
    setTallyRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeTallyRow = (index: number) => {
    setTallyRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitForm = async () => {
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

  const handleSubmitFile = async () => {
    if (!file) {
      showToast(t('dashboard.marking.needsAFile'), 'error');
      return;
    }
    if (tallyRows.length === 0) {
      showToast(t('dashboard.marking.needsAtLeastOneQuestion'), 'error');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const tally: MarkingGuideQuestionTally[] = tallyRows.flatMap((row) =>
        Array.from({ length: Math.max(1, row.count) }, () => ({ question_type: row.question_type }))
      );
      const storagePath = await uploadGuideFile(user.id, request.spekooh_request_id, file);
      await submitMarkingGuideFile(request.spekooh_request_id, tally, storagePath);
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
      {request.paper_file_url && (
        <a
          href={request.paper_file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 transition mb-3"
        >
          <ExternalLink size={14} />
          <span>{t('dashboard.marking.viewQuestionPaper')}</span>
        </a>
      )}
      <p className="text-gray-500 mb-4">{t('dashboard.marking.guideFormSubtitle')}</p>

      <ModeToggle mode={mode} onChange={setMode} t={t} />

      {mode === 'form' ? (
        <>
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
            onClick={handleSubmitForm}
            disabled={submitting}
            className="w-full sm:w-auto bg-primary-500 text-gray-900 h-11 px-6 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
          >
            {t('dashboard.marking.submitGuideButton')}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-900 mb-2">{t('dashboard.marking.uploadFileLabel')}</label>
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-1.5 h-10 px-4 rounded-[10px] border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
              <Upload size={15} />
              <span>{t('dashboard.marking.chooseFile')}</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && (
              <span className="text-sm text-gray-600">
                {t('dashboard.marking.selectedFilePrefix')} {file.name}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-3">{t('dashboard.marking.tallyInstructions')}</p>

          <div className="space-y-2.5 mb-4">
            {tallyRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <select
                  value={row.question_type}
                  onChange={(e) => updateTallyRow(index, { question_type: e.target.value as MarkingGuideQuestion['question_type'] })}
                  className="flex-1 h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  {(Object.keys(QUESTION_TYPE_KEYS) as MarkingGuideQuestion['question_type'][]).map((qType) => (
                    <option key={qType} value={qType}>
                      {t(QUESTION_TYPE_KEYS[qType])}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(e) => updateTallyRow(index, { count: Number(e.target.value) })}
                  placeholder={t('dashboard.marking.tallyCountLabel')}
                  className="w-24 h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  onClick={() => removeTallyRow(index)}
                  className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-[8px] hover:bg-red-100 transition flex-shrink-0"
                  title={t('dashboard.marking.removeQuestion')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setTallyRows((prev) => [...prev, emptyTallyRow()])}
            className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 transition mb-6"
          >
            <Plus size={15} />
            <span>{t('dashboard.marking.addQuestion')}</span>
          </button>

          <button
            onClick={handleSubmitFile}
            disabled={submitting}
            className="w-full sm:w-auto bg-primary-500 text-gray-900 h-11 px-6 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
          >
            {t('dashboard.marking.submitGuideButton')}
          </button>
        </>
      )}
    </div>
  );
}
