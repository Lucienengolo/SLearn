import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManageCategoriesModal from '../components/Dashboard/ManageCategoriesModal';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as categoriesLib from '../lib/categories';
import type { Category } from '../lib/supabase';

vi.mock('../lib/categories');

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Web Development', description: null, created_at: '' },
  { id: 'cat-2', name: 'Data Science', description: null, created_at: '' },
];

function renderModal(props: Partial<Parameters<typeof ManageCategoriesModal>[0]> = {}) {
  return render(
    <LocaleProvider>
      <ManageCategoriesModal
        isOpen={props.isOpen ?? true}
        onClose={props.onClose ?? vi.fn()}
        onCategoriesChanged={props.onCategoriesChanged ?? vi.fn()}
      />
    </LocaleProvider>
  );
}

describe('ManageCategoriesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoriesLib.fetchAllCategories).mockResolvedValue(CATEGORIES);
  });

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists every category with a delete action', async () => {
    renderModal();

    expect(await screen.findByText('Web Development')).toBeInTheDocument();
    expect(screen.getByText('Data Science')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete web development/i })).toBeInTheDocument();
  });

  it('deletes an unused category after confirming', async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesLib.checkCategoryUsage).mockResolvedValue({
      courseCount: 0,
      tutorRequestCount: 0,
      tutorSubjectCount: 0,
      total: 0,
    });
    vi.mocked(categoriesLib.deleteCategory).mockResolvedValue(undefined);
    const onCategoriesChanged = vi.fn();
    renderModal({ onCategoriesChanged });

    await user.click(await screen.findByRole('button', { name: /delete web development/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(categoriesLib.deleteCategory).toHaveBeenCalledWith('cat-1');
    expect(await screen.findByText('Data Science')).toBeInTheDocument();
    expect(screen.queryByText('Web Development')).not.toBeInTheDocument();
    expect(onCategoriesChanged).toHaveBeenCalled();
  });

  // Regression: courses.category_id is ON DELETE SET NULL and
  // tutor_subjects.category_id is ON DELETE CASCADE -- neither would raise
  // a hard DB error, so a naive delete would either silently blank a
  // course's category or silently wipe a tutor's subject-matching rows.
  // checkCategoryUsage must be consulted BEFORE the delete call, not after.
  it('blocks deletion and shows a count when the category is in use', async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesLib.checkCategoryUsage).mockResolvedValue({
      courseCount: 2,
      tutorRequestCount: 1,
      tutorSubjectCount: 0,
      total: 3,
    });
    renderModal();

    await user.click(await screen.findByRole('button', { name: /delete web development/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText(/3/)).toBeInTheDocument();
    expect(categoriesLib.deleteCategory).not.toHaveBeenCalled();
    expect(screen.getByText('Web Development')).toBeInTheDocument();
  });

  it('cancelling the confirm dialog does not delete anything', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('button', { name: /delete web development/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(categoriesLib.checkCategoryUsage).not.toHaveBeenCalled();
    expect(categoriesLib.deleteCategory).not.toHaveBeenCalled();
    expect(screen.getByText('Web Development')).toBeInTheDocument();
  });

  it('shows an empty state when there are no categories', async () => {
    vi.mocked(categoriesLib.fetchAllCategories).mockResolvedValue([]);
    renderModal();

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
  });
});
