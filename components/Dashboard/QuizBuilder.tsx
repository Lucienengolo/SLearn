import { Plus, Trash2 } from 'lucide-react';

export type QuestionDraft = {
  key: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false';
  options: string[];
  correct_answer: string;
  points: number;
};

export type QuizDraft = {
  enabled: boolean;
  title: string;
  passing_score: number;
  questions: QuestionDraft[];
};

export const emptyQuizDraft = (title: string): QuizDraft => ({
  enabled: false,
  title,
  passing_score: 70,
  questions: [],
});

const newQuestion = (): QuestionDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  question_text: '',
  question_type: 'multiple_choice',
  options: ['', '', '', ''],
  correct_answer: '',
  points: 1,
});

type QuizBuilderProps = {
  label: string;
  description: string;
  quiz: QuizDraft;
  onChange: (quiz: QuizDraft) => void;
};

export default function QuizBuilder({ label, description, quiz, onChange }: QuizBuilderProps) {
  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    });
  };

  const removeQuestion = (key: string) => {
    onChange({ ...quiz, questions: quiz.questions.filter((q) => q.key !== key) });
  };

  if (!quiz.enabled) {
    return (
      <div className="border border-dashed border-gray-200 rounded-[10px] p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-2xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...quiz, enabled: true, questions: quiz.questions.length ? quiz.questions : [newQuestion()] })}
          className="flex items-center gap-1.5 px-3 h-9 rounded-[10px] border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition flex-shrink-0 whitespace-nowrap"
        >
          <Plus size={14} />
          Add quiz
        </button>
      </div>
    );
  }

  return (
    <div className="border border-primary-200 bg-primary-50/40 rounded-[10px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <button
          type="button"
          onClick={() => onChange({ ...quiz, enabled: false })}
          className="text-2xs text-red-600 hover:underline"
        >
          Remove quiz
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <input
          value={quiz.title}
          onChange={(e) => onChange({ ...quiz, title: e.target.value })}
          placeholder="Quiz title"
          className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={quiz.passing_score}
            onChange={(e) => onChange({ ...quiz, passing_score: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
            className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            title="Passing score (%)"
          />
          <span className="text-2xs text-gray-500 whitespace-nowrap">% to pass</span>
        </div>
      </div>

      <div className="space-y-3">
        {quiz.questions.map((q, index) => (
          <div key={q.key} className="bg-white border border-canvas-150 rounded-[10px] p-3 space-y-2">
            <div className="flex items-start gap-2">
              <input
                value={q.question_text}
                onChange={(e) => updateQuestion(q.key, { question_text: e.target.value })}
                placeholder={`Question ${index + 1}`}
                className="flex-1 px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
              <button
                type="button"
                onClick={() => removeQuestion(q.key)}
                aria-label={`Delete question ${index + 1}`}
                title={`Delete question ${index + 1}`}
                className="text-red-500 hover:text-red-700 p-2 flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={q.question_type}
                title="Question type"
                onChange={(e) => {
                  const question_type = e.target.value as 'multiple_choice' | 'true_false';
                  updateQuestion(q.key, {
                    question_type,
                    correct_answer: '',
                    options: question_type === 'true_false' ? ['True', 'False'] : ['', '', '', ''],
                  });
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True / False</option>
              </select>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                Points
                <input
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) => updateQuestion(q.key, { points: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </label>
            </div>

            {q.question_type === 'multiple_choice' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={q.correct_answer !== '' && q.correct_answer === opt}
                      onChange={() => updateQuestion(q.key, { correct_answer: opt })}
                      disabled={!opt.trim()}
                      aria-label={`Option ${i + 1} is correct`}
                      title="Mark as correct answer"
                    />
                    <input
                      value={opt}
                      onChange={(e) => {
                        const options = [...q.options];
                        const wasCorrect = q.correct_answer === opt;
                        options[i] = e.target.value;
                        updateQuestion(q.key, { options, correct_answer: wasCorrect ? e.target.value : q.correct_answer });
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {['True', 'False'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={q.correct_answer === opt}
                      onChange={() => updateQuestion(q.key, { correct_answer: opt })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange({ ...quiz, questions: [...quiz.questions, newQuestion()] })}
          className="flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
        >
          <Plus size={14} />
          Add question
        </button>
      </div>
    </div>
  );
}
