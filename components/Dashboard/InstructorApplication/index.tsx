import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { InstructorApplication } from '../../../lib/supabase';
import { fetchMyApplication } from '../../../lib/instructorApplications';
import ApplicationWizard from './ApplicationWizard';
import VerificationPipeline from './VerificationPipeline';

export default function InstructorApplicationFlow() {
  const { user } = useAuth();
  const [application, setApplication] = useState<InstructorApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const reload = () => {
    if (!user) return;
    setLoading(true);
    fetchMyApplication(user.id)
      .then(setApplication)
      .finally(() => setLoading(false));
  };

  useEffect(reload, [user]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!application || application.status === 'draft' || editing) {
    return (
      <ApplicationWizard
        initialApplication={application}
        onSubmitted={() => {
          setEditing(false);
          reload();
        }}
      />
    );
  }

  return <VerificationPipeline application={application} onEdit={() => setEditing(true)} />;
}
