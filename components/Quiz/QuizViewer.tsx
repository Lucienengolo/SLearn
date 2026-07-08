import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { supabase, Quiz, QuizQuestion } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type QuizViewerProps = {
  quizId: string;
  onBack: () => void;
  onComplete: () => void;
};

type QuizResult = {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
};

export default function QuizViewer({ quizId, onBack, onComplete }: QuizViewerProps) {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizData();
  }, [quizId]);

  const fetchQuizData = async () => {
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizData) {
      setQuiz(quizData);

      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (questionsData) setQuestions(questionsData);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    let score = 0;
    let totalPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      if (answers[question.id] === question.correct_answer) {
        score += question.points;
      }
    });

    const percentage = Math.round((score / totalPoints) * 100);
    const passed = percentage >= quiz.passing_score;
    const buildResult = () => ({
      score: percentage,
      passed,
      correctCount: questions.filter((q) => answers[q.id] === q.correct_answer).length,
      totalQuestions: questions.length,
    });

    // Guest mode: grade locally, no server write — matches lesson completion
    // in LessonViewer, which is what actually records guest XP.
    if (!user) {
      setResult(buildResult());
      setSubmitted(true);
      if (passed) onComplete();
      return;
    }

    const { error } = await supabase.from('quiz_attempts').insert({
      student_id: user.id,
      quiz_id: quizId,
      score: percentage,
      total_points: totalPoints,
      passed,
      answers,
    });

    if (!error) {
      setResult(buildResult());
      setSubmitted(true);

      if (passed) {
        onComplete();
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!quiz) return null;

  if (submitted && result) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-[14px] border border-canvas-150 p-8 text-center">
          {result.passed ? (
            <div className="space-y-3">
              <span className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-600" />
              </span>
              <h2 className="font-display text-3xl text-gray-900">Congratulations!</h2>
              <p className="text-lg text-gray-500">You passed the quiz</p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle size={36} className="text-red-600" />
              </span>
              <h2 className="font-display text-3xl text-gray-900">Keep trying!</h2>
              <p className="text-lg text-gray-500">You can retake this quiz anytime</p>
            </div>
          )}

          <div className="mt-7 p-5 bg-canvas-25 rounded-[10px] border border-canvas-150">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="font-display text-3xl text-primary-700">{result.score}%</p>
                <p className="text-sm text-gray-500 mt-1">Your score</p>
              </div>
              <div>
                <p className="font-display text-3xl text-gray-900">
                  {result.correctCount}/{result.totalQuestions}
                </p>
                <p className="text-sm text-gray-500 mt-1">Correct answers</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Passing score: {quiz.passing_score}%
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {!result.passed && (
              <button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  setResult(null);
                }}
                className="w-full bg-primary-500 text-gray-900 h-12 rounded-[10px] hover:bg-primary-400 transition font-semibold"
              >
                Retake quiz
              </button>
            )}
            <button
              onClick={onBack}
              className="w-full bg-white border border-gray-200 text-gray-700 h-12 rounded-[10px] hover:bg-gray-50 transition font-medium"
            >
              Back to lesson
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
      >
        <ArrowLeft size={16} />
        <span>Back to lesson</span>
      </button>

      <div className="rounded-[14px] border border-canvas-150 p-6 md:p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-gray-900 mb-2">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-gray-500">{quiz.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Passing score: {quiz.passing_score}%
          </p>
        </div>

        <div className="space-y-7">
          {questions.map((question, index) => (
            <div key={question.id} className="pb-7 border-b border-canvas-150 last:border-b-0 last:pb-0">
              <h3 className="font-semibold text-gray-900 mb-3.5">
                {index + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {Array.isArray(question.options) && question.options.map((option: string) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition ${
                      answers[question.id] === option
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) =>
                        setAnswers({ ...answers, [question.id]: e.target.value })
                      }
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700 text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-canvas-150">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full bg-primary-500 text-gray-900 h-12 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allAnswered ? 'Submit quiz' : `Answer all questions (${Object.keys(answers).length}/${questions.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
