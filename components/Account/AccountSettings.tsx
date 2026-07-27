import { useEffect, useState } from 'react';
import { Camera, LogOut, User as UserIcon, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import { TOTEMS, totemByName } from '../../lib/totems';
import { fetchStudentProgress, StudentProgressTier } from '../../lib/gamification';
import DashboardSidebar from '../Dashboard/DashboardSidebar';
import ConfirmDialog from '../UI/ConfirmDialog';

type AccountSettingsProps = {
  onBack: () => void;
  onNavigate: (page: string) => void;
};

// Rebuilt to match the Pathfinder "Profile" reference page (2026-07-27):
// persistent sidebar + profile header card + grouped sections. "Keeping a
// reflection to my app": no fake public-profile link/visibility toggles
// (S@Learn has no public profile page) and no fake "Free"/"Plus" pill (no
// subscription tiers exist) -- the header shows what's actually real
// instead: a verified-instructor badge, or a student's totem + league tier.
export default function AccountSettings({ onBack, onNavigate }: AccountSettingsProps) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [totem, setTotem] = useState(profile?.totem ?? '');
  const [savingTotem, setSavingTotem] = useState(false);
  const [totemMessage, setTotemMessage] = useState('');
  const [totemError, setTotemError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [tier, setTier] = useState<StudentProgressTier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const isStudent = profile?.role === 'student';

  useEffect(() => {
    if (user && isStudent) {
      fetchStudentProgress(user.id).then((p) => setTier(p.tier));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStudent]);

  if (!user || !profile) return null;

  const handleAvatarChange = async (file: File) => {
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const url = await uploadAvatar(user.id, file);
      if (!url) {
        setAvatarError('Could not upload image. Please try again.');
        return;
      }
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) {
        setAvatarError(error.message);
        return;
      }
      await refreshProfile();
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileSave = async () => {
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null, bio: bio.trim() || null })
        .eq('id', user.id);

      if (error) {
        setProfileError(error.message);
        return;
      }
      await refreshProfile();
      setProfileMessage('Profile updated.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTotemSave = async (nextTotem: string) => {
    setTotem(nextTotem);
    setSavingTotem(true);
    setTotemMessage('');
    setTotemError('');
    try {
      const { error } = await supabase.from('profiles').update({ totem: nextTotem }).eq('id', user.id);
      if (error) {
        setTotemError(error.message);
        return;
      }
      await refreshProfile();
      setTotemMessage('Totem updated.');
    } finally {
      setSavingTotem(false);
    }
  };

  const handleEmailChange = async () => {
    setSavingEmail(true);
    setEmailMessage('');
    setEmailError('');
    try {
      if (!newEmail.trim()) {
        setEmailError('Enter a new email address.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        setEmailError(error.message);
        return;
      }
      setEmailMessage('Check your new email address for a confirmation link to finish the change.');
      setNewEmail('');
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordChange = async () => {
    setSavingPassword(true);
    setPasswordMessage('');
    setPasswordError('');
    try {
      if (newPassword.length < 8) {
        setPasswordError('Password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      setPasswordMessage('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        showToast('Failed to delete account. Please try again or contact support.', 'error');
        return;
      }
      await signOut();
      onNavigate('home');
    } finally {
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  const totemInfo = totemByName(totem);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
      <DashboardSidebar
        current="account-settings"
        onNavigate={onNavigate}
        fullName={profile.full_name}
        totem={isStudent ? totemInfo : null}
        tier={isStudent ? tier : null}
        role={profile.role}
      />

      <div className="min-w-0">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4 lg:hidden">
          ← Back
        </button>

        {/* Profile header -- avatar + name + a real status badge (verified
            instructor, or nothing fabricated for students -- no fake
            "Free"/"Plus" pill, no public-profile link, since neither
            subscription tiers nor public profiles exist in this product). */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your avatar"
                className="w-20 h-20 rounded-full object-cover border border-canvas-150"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                <UserIcon size={36} />
              </div>
            )}
            <label
              className="absolute -bottom-1 -right-1 bg-primary-500 text-gray-900 p-1.5 rounded-full cursor-pointer hover:bg-primary-400 transition"
              aria-label="Change avatar"
            >
              <Camera size={14} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarChange(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl text-gray-900">{profile.full_name || profile.email}</h1>
              {profile.role === 'instructor' && profile.verified && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                  <CheckCircle size={12} />
                  Verified instructor
                </span>
              )}
              {isStudent && tier && (
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded font-medium">{tier}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {uploadingAvatar ? 'Uploading…' : 'PNG or JPG, square images look best.'}
            </p>
            {avatarError && <p className="text-sm text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>

        <div className="rounded-[14px] border border-canvas-150 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Basic information</h2>
          <p className="text-sm text-gray-500 mb-4">Your name and bio, shown across the platform.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                id="settings-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>
            <div>
              <label htmlFor="settings-bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                id="settings-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>
            {profileMessage && <p className="text-sm text-primary-700">{profileMessage}</p>}
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            <button
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="bg-primary-500 text-gray-900 h-11 px-4 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
            >
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>

          {isStudent && (
            <div className="mt-6 pt-6 border-t border-canvas-150">
              <p className="text-sm font-medium text-gray-700 mb-1">Totem</p>
              <p className="text-sm text-gray-500 mb-4">
                Pick the national team totem that represents you. Shown on your dashboard.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Totem">
                {TOTEMS.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    role="radio"
                    aria-checked={totem === t.name}
                    disabled={savingTotem}
                    onClick={() => handleTotemSave(t.name)}
                    className={`flex items-center gap-3 text-left px-3.5 py-2.5 rounded-[10px] border transition ${
                      totem === t.name ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${t.bgClass}`}
                      aria-hidden="true"
                    >
                      {t.emoji}
                    </span>
                    <span>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-2xs text-gray-500">{t.country}</p>
                    </span>
                  </button>
                ))}
              </div>
              {totemMessage && <p className="text-sm text-primary-700 mt-3">{totemMessage}</p>}
              {totemError && <p className="text-sm text-red-600 mt-3">{totemError}</p>}
            </div>
          )}
        </div>

        <div className="rounded-[14px] border border-canvas-150 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Account information</h2>
          <p className="text-sm text-gray-500 mb-4">Current: {user.email}</p>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
            {emailMessage && <p className="text-sm text-primary-700">{emailMessage}</p>}
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
            <button
              onClick={handleEmailChange}
              disabled={savingEmail}
              className="bg-white border border-gray-200 text-gray-700 h-11 px-4 rounded-[10px] hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              {savingEmail ? 'Sending…' : 'Change email'}
            </button>
          </div>
        </div>

        <div className="rounded-[14px] border border-canvas-150 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Password</h2>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
            {passwordMessage && <p className="text-sm text-primary-700">{passwordMessage}</p>}
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            <button
              onClick={handlePasswordChange}
              disabled={savingPassword}
              className="bg-white border border-gray-200 text-gray-700 h-11 px-4 rounded-[10px] hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

        <div className="rounded-[14px] border border-red-200 p-6 mb-6">
          <h2 className="font-semibold text-red-700 mb-1">Delete account</h2>
          <p className="text-sm text-gray-500 mb-4">
            Permanently deletes your account and everything tied to it — courses, enrollments, bookings. This
            cannot be undone.
          </p>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="bg-white border border-red-200 text-red-600 h-11 px-4 rounded-[10px] hover:bg-red-50 transition font-medium"
          >
            Delete my account
          </button>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 text-red-600 hover:bg-red-50 h-11 px-4 rounded-[10px] transition font-medium"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete your account?"
        message="This permanently deletes your account and everything tied to it. This cannot be undone."
        confirmLabel={deletingAccount ? 'Deleting…' : 'Delete my account'}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
