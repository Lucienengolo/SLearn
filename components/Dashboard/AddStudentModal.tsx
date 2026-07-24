import { useState } from 'react';
import { X } from 'lucide-react';
import { enrollStudentByEmail } from '../../lib/instructorEnrollment';

type AddStudentModalProps = {
  isOpen: boolean;
  courseId: string;
  onClose: () => void;
  onEnrolled: () => void;
};

export default function AddStudentModal({ isOpen, courseId, onClose, onEnrolled }: AddStudentModalProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await enrollStudentByEmail(courseId, email);
      setEmail('');
      onEnrolled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add student.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[14px] max-w-sm w-full p-6 relative" role="dialog" aria-modal="true" aria-label="Add student">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className="font-display text-xl text-gray-900 mb-1">Add a student</h2>
        <p className="text-sm text-gray-500 mb-5">
          Enroll a student who paid outside checkout (bank transfer, mobile money).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-student-email" className="block text-sm font-medium text-gray-700 mb-1">
              Student email
            </label>
            <input
              id="add-student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add student'}
          </button>
        </form>
      </div>
    </div>
  );
}
