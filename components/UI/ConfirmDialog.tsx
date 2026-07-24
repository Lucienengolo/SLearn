import { AlertTriangle } from 'lucide-react';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Replaces browser confirm() (found in InstructorDashboard.tsx's delete
// flow) with an in-app dialog that matches the app's own styling, per the
// same "not modern by standards" gap the toast system addresses.
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-[14px] max-w-sm w-full p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-3 mb-2">
          {destructive && (
            <span className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </span>
          )}
          <div>
            <h2 id="confirm-dialog-title" className="font-display text-xl text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-600 mt-1.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-[10px] border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-11 rounded-[10px] font-semibold transition ${
              destructive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-primary-500 text-gray-900 hover:bg-primary-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
