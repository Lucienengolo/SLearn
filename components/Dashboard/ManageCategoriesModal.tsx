import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Category } from '../../lib/supabase';
import { fetchAllCategories, checkCategoryUsage, deleteCategory } from '../../lib/categories';
import { useLocale } from '../../contexts/LocaleContext';
import ConfirmDialog from '../UI/ConfirmDialog';

type ManageCategoriesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged: () => void;
};

// Founder request, 2026-08-01 ("add a clear option to add or delete a
// course category") -- "add" already existed (CourseEditor.tsx's inline
// "+" chip), this is the missing "delete" half. Scoped to verified
// instructors only via 0045_instructors_delete_categories.sql's RLS
// policy; this modal is the UI half of that, plus the app-level "is it
// actually safe to delete" check the DB alone can't guarantee (see
// lib/categories.ts's checkCategoryUsage comment for why).
export default function ManageCategoriesModal({ isOpen, onClose, onCategoriesChanged }: ManageCategoriesModalProps) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(true);
    fetchAllCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingCategory = categories.find((c) => c.id === pendingDeleteId);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setError('');
    setCheckingUsage(true);
    try {
      const usage = await checkCategoryUsage(pendingDeleteId);
      if (usage.total > 0) {
        setError(`${t('dashboard.manageCategories.inUseErrorPrefix')} ${usage.total} ${t('dashboard.manageCategories.inUseErrorSuffix')}`);
        setPendingDeleteId(null);
        return;
      }

      await deleteCategory(pendingDeleteId);
      setCategories((prev) => prev.filter((c) => c.id !== pendingDeleteId));
      onCategoriesChanged();
      setPendingDeleteId(null);
    } catch {
      setError(t('dashboard.manageCategories.deleteError'));
      setPendingDeleteId(null);
    } finally {
      setCheckingUsage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-[14px] max-w-sm w-full p-6 relative"
        role="dialog"
        aria-modal="true"
        aria-label={t('dashboard.manageCategories.title')}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
          aria-label={t('dashboard.manageCategories.close')}
        >
          <X size={20} />
        </button>

        <h2 className="font-display text-xl text-gray-900 mb-1">{t('dashboard.manageCategories.title')}</h2>
        <p className="text-sm text-gray-500 mb-5">{t('dashboard.manageCategories.subtitle')}</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm mb-4">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">{t('common.loadingEllipsis')}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500">{t('dashboard.manageCategories.empty')}</p>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-[10px] hover:bg-gray-50">
                <span className="text-sm text-gray-800 truncate">{cat.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(cat.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-[8px] transition flex-shrink-0"
                  aria-label={`${t('dashboard.manageCategories.deleteAria')} ${cat.name}`}
                  title={`${t('dashboard.manageCategories.deleteAria')} ${cat.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={t('dashboard.manageCategories.confirmTitle')}
        message={pendingCategory ? `"${pendingCategory.name}" — ${t('dashboard.manageCategories.confirmMessage')}` : t('dashboard.manageCategories.confirmMessage')}
        confirmLabel={checkingUsage ? t('dashboard.manageCategories.checkingUsage') : t('dashboard.manageCategories.confirmDelete')}
        cancelLabel={t('dashboard.manageCategories.confirmCancel')}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
