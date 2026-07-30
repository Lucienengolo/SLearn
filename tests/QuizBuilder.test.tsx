import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizBuilder, { emptyQuizDraft } from '../components/Dashboard/QuizBuilder';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

function renderBuilder(props: Partial<ComponentProps<typeof QuizBuilder>> = {}) {
  return render(
    <LocaleProvider>
      <QuizBuilder
        label="Final exam"
        description="Optional quiz"
        quiz={props.quiz ?? emptyQuizDraft('Final exam')}
        onChange={props.onChange ?? vi.fn()}
      />
    </LocaleProvider>
  );
}

describe('QuizBuilder', () => {
  it('shows an "Add quiz" CTA when disabled', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: 'Add quiz' })).toBeInTheDocument();
  });

  it('enables the quiz builder and adds a question', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder({ onChange });

    await user.click(screen.getByRole('button', { name: 'Add quiz' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderBuilder();
    expect(screen.getByRole('button', { name: 'Ajouter un quiz' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('renders the True/False labels translated while keeping the underlying values in French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    const quiz = emptyQuizDraft('Quiz');
    quiz.enabled = true;
    quiz.questions = [
      {
        key: 'q1',
        question_text: 'Is this true?',
        question_type: 'true_false',
        options: ['True', 'False'],
        correct_answer: '',
        points: 1,
      },
    ];
    renderBuilder({ quiz });

    expect(screen.getByText('Vrai')).toBeInTheDocument();
    expect(screen.getByText('Faux')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
