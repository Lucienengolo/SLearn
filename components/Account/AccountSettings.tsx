import { useState } from 'react';
import { ArrowLeft, Camera, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';

type AccountSettingsProps = {
  onBack: () => void;
};

export default function AccountSettings({ onBack }: AccountSettingsProps) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <h1 className="text-3xl font-bold text-gray-800 mb-1">Account settings</h1>
      <p className="text-gray-600 mb-8">Manage your profile, email, and password.</p>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Profile</h2>
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your avatar"
                className="w-20 h-20 rounded-full object-cover border border-gray-200"
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
          <div className="text-sm text-gray-600">
            {uploadingAvatar ? 'Uploading…' : 'PNG or JPG, square images look best.'}
            {avatarError && <p className="text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {profileMessage && <p className="text-sm text-primary-700">{profileMessage}</p>}
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          <button
            onClick={handleProfileSave}
            disabled={savingProfile}
            className="bg-primary-500 text-gray-900 px-4 py-2 rounded-lg hover:bg-primary-400 transition font-medium disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Email</h2>
        <p className="text-sm text-gray-600 mb-4">Current: {user.email}</p>
        <div className="space-y-3">
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {emailMessage && <p className="text-sm text-primary-700">{emailMessage}</p>}
          {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          <button
            onClick={handleEmailChange}
            disabled={savingEmail}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
          >
            {savingEmail ? 'Sending…' : 'Change email'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Password</h2>
        <div className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {passwordMessage && <p className="text-sm text-primary-700">{passwordMessage}</p>}
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <button
            onClick={handlePasswordChange}
            disabled={savingPassword}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
          >
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>

      <button
        onClick={signOut}
        className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition font-medium"
      >
        <LogOut size={18} />
        Sign out
      </button>
    </div>
  );
}
