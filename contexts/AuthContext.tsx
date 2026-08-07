import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { identifyUser, resetAnalytics, trackEvent } from '../lib/analytics';
import { markSessionStart, clearSessionStart, isSessionExpired } from '../lib/sessionTimeout';
import { useToast } from './ToastContext';
import { useLocale } from './LocaleContext';

// Checked on mount and every 15 min while the tab stays open -- frequent
// enough that nobody stays signed in meaningfully past 72h, infrequent
// enough it's not a real resource cost.
const SESSION_CHECK_INTERVAL_MS = 15 * 60 * 1000;

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string, fullName: string, whatsappContact?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { showToast } = useToast();
  const { t } = useLocale();

  const fetchProfile = async (userId: string) => {
    // public_profiles (2026-08-02 security fix, 0046_restrict_profile_email.sql)
    // -- email isn't a selectable column on `profiles` for a plain client
    // query anymore, including reading one's own row. Display of the
    // signed-in user's email uses `user.email` from the auth session
    // instead (see Header.tsx/AccountSettings.tsx/CertificatesPage.tsx).
    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // A forced sign-out from the 72h session cap used to happen silently --
  // the user would just find themselves logged out with no explanation.
  // showToast/t here are captured once at effect setup (empty dep array,
  // intentional -- re-running this effect on every locale change would
  // mean tearing down and re-subscribing the auth listener/interval just
  // to keep a toast string current), so a session that expires long after
  // a locale switch shows the message in whatever locale was active on
  // mount. Acceptable: this path fires at most once per 72h, and the
  // moment itself (silently losing your session) mattered far more than
  // which language explains it.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isSessionExpired()) {
        clearSessionStart();
        supabase.auth.signOut();
        showToast(t('auth.sessionExpiredMessage'), 'info');
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        identifyUser(session.user.id, { email: session.user.email });
        fetchProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Fired when the user lands back on the app via the password-reset
      // email link -- Supabase establishes a real (recovery-scoped)
      // session automatically. Gate the "set a new password" prompt on
      // this rather than just "is there a session", since a normal
      // sign-in fires SIGNED_IN, not this.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      // Only a genuine new sign-in resets the 72h clock -- a silent
      // TOKEN_REFRESHED must NOT extend it, or the max-session cap would
      // never actually apply to a tab left open and quietly refreshing.
      if (event === 'SIGNED_IN') {
        markSessionStart();
      }
      if (event === 'SIGNED_OUT') {
        clearSessionStart();
      }

      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          identifyUser(session.user.id, { email: session.user.email });
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
          resetAnalytics();
        }
      })();
    });

    const sessionCheckInterval = setInterval(() => {
      if (isSessionExpired()) {
        clearSessionStart();
        supabase.auth.signOut();
        showToast(t('auth.sessionExpiredMessage'), 'info');
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, []);

  // Accounts are single-role and start as students. Becoming an instructor
  // requires the application + interview pipeline (see InstructorApplication)
  // and is only granted by the instructor-approval backend after approval.
  //
  // The profile row itself is created server-side by the on_auth_user_created
  // trigger (0005_auth_hardening.sql), not here — that way it works whether
  // or not email confirmation is required. When confirmation is on, signUp()
  // returns with no active session, so a client-side insert would run as
  // `anon` and get rejected by RLS.
  const signUp = async (email: string, password: string, fullName: string, whatsappContact?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // whatsapp_contact is optional at signup (founder decision,
        // 2026-08-07) -- reused by the on_auth_user_created trigger
        // (0059_profile_whatsapp_contact.sql), same mechanism as full_name.
        // undefined is simply omitted from the stored raw_user_meta_data,
        // so the trigger's `->> 'whatsapp_contact'` reads null.
        data: { full_name: fullName, whatsapp_contact: whatsappContact || undefined },
      },
    });

    if (error) throw error;

    trackEvent('signed_up');
    return { needsEmailConfirmation: !data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    trackEvent('signed_in');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isPasswordRecovery,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
