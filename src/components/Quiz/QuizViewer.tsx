import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { supabase, Quiz, QuizQuestion } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type QuizViewerProps = {
  quizId: string;
  onBack: () => void;
  onComplete: () => void;
};

export default function QuizViewer({ quizId, onBack, onComplete }: QuizViewerProps) {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
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
    if (!user || !quiz) return;

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

    const { error } = await supabase.from('quiz_attempts').insert({
      student_id: user.id,
      quiz_id: quizId,
      score: percentage,
      total_points: totalPoints,
      passed,
      answers,
    });

    if (!error) {
      setResult({
        score: percentage,
        passed,
        correctCount: questions.filter((q) => answers[q.id] === q.correct_answer).length,
        totalQuestions: questions.length,
      });
      setSubmitted(true);

      if (passed) {
        onComplete();
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!quiz) return null;

  if (submitted && result) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {result.passed ? (
            <div className="space-y-4">
              <CheckCircle size={64} className="mx-auto text-green-600" />
              <h2 className="text-3xl font-bold text-gray-800">Congratulations!</h2>
              <p className="text-xl text-gray-600">You passed the quiz!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <XCircle size={64} className="mx-auto text-red-600" />
              <h2 className="text-3xl font-bold text-gray-800">Keep Trying!</h2>
              <p className="text-xl text-gray-600">You can retake this quiz anytime.</p>
            </div>
          )}

          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-blue-600">{result.score}%</p>
                <p className="text-gray-600">Your Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">
                  {result.correctCount}/{result.totalQuestions}
                </p>
                <p className="text-gray-600">Correct Answers</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Passing Score: {quiz.passing_score}%
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {!result.passed && (
              <button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  setResult(null);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Retake Quiz
              </button>
            )}
            <button
              onClick={onBack}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Back to Lesson
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Lesson</span>
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-gray-600">{quiz.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Passing Score: {quiz.passing_score}%
          </p>
        </div>

        <div className="space-y-8">
          {questions.map((question, index) => (
            <div key={question.id} className="border-b pb-6 last:border-b-0">
              <h3 className="font-semibold text-gray-800 mb-4">
                {index + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {Array.isArray(question.options) && question.options.map((option: string) => (
                  <label
                    key={option}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition ${
                      answers[question.id] === option
                        ? 'border-blue-500 bg-blue-50'
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
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allAnswered ? 'Submit Quiz' : `Answer All Questions (${Object.keys(answers).length}/${questions.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
