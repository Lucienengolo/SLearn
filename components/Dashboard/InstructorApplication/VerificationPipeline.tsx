import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { InstructorApplication, InstructorCredential, Interview } from '../../../lib/supabase';
import { fetchCredentials, fetchMyInterview, getCalBookingLink } from '../../../lib/instructorApplications';
import { trackEvent } from '../../../lib/analytics';

const STAGES = ['submitted', 'review', 'interview', 'approved'] as const;

type Props = {
  application: InstructorApplication;
};

export default function VerificationPipeline({ application }: Props) {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<InstructorCredential[]>([]);
  const [interview, setInterview] = useState<Interview | null>(null);

  useEffect(() => {
    fetchCredentials(application.id).then(setCredentials).catch(() => setCredentials([]));
    fetchMyInterview(application.id).then(setInterview).catch(() => setInterview(null));
  }, [application.id]);

  // Fires once per status value (the effect only re-runs when the
  // dependency actually changes) — not on every render this component
  // happens to take.
  useEffect(() => {
    if (application.status === 'approved' || application.status === 'rejected') {
      trackEvent('instructor_application_decided', { status: application.status });
    }
  }, [application.status]);

  const rejected = application.status === 'rejected';
  const currentStageIndex = rejected
    ? -1
    : STAGES.indexOf(application.status as (typeof STAGES)[number]);

  const hasGovernmentId = credentials.some((c) => c.credential_type === 'government_id' && c.verified);
  const hasCredentialsVerified = credentials.some(
    (c) => ['degree', 'certificate', 'cv', 'portfolio'].includes(c.credential_type) && c.verified
  );
  const hasSampleLesson = credentials.some((c) => c.credential_type === 'sample_lesson');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Instructor verification</h1>
      <p className="text-gray-600 mb-8">
        Track your application through review, the compulsory interview, and the final decision.
      </p>

      {rejected ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
            <XCircle size={20} /> Application not approved
          </div>
          {application.decision_notes && (
            <p className="text-sm text-red-700">{application.decision_notes}</p>
          )}
        </div>
      ) : (
        <ol className="flex flex-wrap gap-2 mb-8">
          {STAGES.map((stage, i) => {
            const done = i < currentStageIndex || (stage === 'approved' && application.status === 'approved');
            const active = i === currentStageIndex;
            return (
              <li
                key={stage}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full capitalize ${
                  active
                    ? 'bg-primary-600 text-white'
                    : done
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {done ? <CheckCircle size={14} /> : active ? <Clock size={14} /> : <Circle size={14} />}
                {stage}
              </li>
            );
          })}
        </ol>
      )}

      {application.status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8 text-green-800">
          <p className="font-semibold mb-1">You're verified!</p>
          <p className="text-sm">Sign out and back in (or refresh) to unlock your instructor studio.</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        <ChecklistRow label="Government ID verified" done={hasGovernmentId} />
        <ChecklistRow label="Credentials verified" done={hasCredentialsVerified} />
        <ChecklistRow
          label="Background check"
          done={application.background_check_status === 'clear'}
          note={
            application.background_check_status === 'flagged'
              ? 'Flagged — a reviewer will follow up'
              : application.background_check_status === 'in_progress'
              ? 'In progress'
              : undefined
          }
        />
        <ChecklistRow label="Sample lesson submitted" done={hasSampleLesson} />
        <ChecklistRow
          label="Compulsory interview"
          done={interview?.outcome === 'pass'}
          note={
            interview
              ? interview.scheduled_at
                ? `Scheduled ${new Date(interview.scheduled_at).toLocaleString()} — ${interview.outcome}`
                : interview.outcome
              : 'Not scheduled yet'
          }
        />
      </div>

      {interview?.meeting_url && interview.outcome === 'pending' && (
        <div className="mt-4 bg-primary-50 border border-primary-100 rounded-lg p-4 text-sm text-primary-800">
          <a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Join your interview
          </a>
        </div>
      )}

      {!interview && !rejected && application.status !== 'approved' && (
        (() => {
          const calLink = getCalBookingLink(application.full_name ?? '', user?.email ?? '');
          return calLink ? (
            <div className="mt-4">
              <a
                href={calLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium"
              >
                Schedule your interview on Cal.com
              </a>
            </div>
          ) : null;
        })()
      )}
    </div>
  );
}

function ChecklistRow({ label, done, note }: { label: string; done: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle size={18} className="text-primary-600" />
        ) : (
          <Circle size={18} className="text-gray-300" />
        )}
        <span className="text-sm text-gray-800">{label}</span>
      </div>
      {note && <span className="text-xs text-gray-500">{note}</span>}
    </div>
  );
}
