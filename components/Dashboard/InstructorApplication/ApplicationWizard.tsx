import { cloneElement, useEffect, useState } from 'react';
import { CheckCircle, Upload } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { trackEvent } from '../../../lib/analytics';
import { supabase, Category, InstructorApplication, InstructorCredential } from '../../../lib/supabase';
import { isValidWhatsappContact } from '../../../lib/tutorRequests';
import {
  ApplicationDraft,
  fetchCredentials,
  getCalBookingLink,
  saveDraft,
  submitApplication,
  uploadCredential,
} from '../../../lib/instructorApplications';
import IdentityCapture from './IdentityCapture';

const STEPS = [
  'Profile & qualifications',
  'Experience',
  'Tutoring (optional)',
  'Course proposal',
  'Credentials & identity',
  'Interview scheduling',
] as const;

type Props = {
  initialApplication: InstructorApplication | null;
  onSubmitted: () => void;
};

export default function ApplicationWizard({ initialApplication, onSubmitted }: Props) {
  const { user } = useAuth();
  const [application, setApplication] = useState<InstructorApplication | null>(initialApplication);
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [credentials, setCredentials] = useState<InstructorCredential[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState<ApplicationDraft>({
    full_name: initialApplication?.full_name ?? '',
    address: initialApplication?.address ?? '',
    headline: initialApplication?.headline ?? '',
    bio: initialApplication?.bio ?? '',
    qualifications: initialApplication?.qualifications ?? '',
    years_experience: initialApplication?.years_experience ?? undefined,
    areas_of_expertise: initialApplication?.areas_of_expertise ?? [],
    proposed_course_title: initialApplication?.proposed_course_title ?? '',
    proposed_course_description: initialApplication?.proposed_course_description ?? '',
    proposed_course_category_id: initialApplication?.proposed_course_category_id ?? null,
    offers_tutoring: initialApplication?.offers_tutoring ?? false,
    tutoring_category_ids: initialApplication?.tutoring_category_ids ?? [],
    tutoring_neighborhood: initialApplication?.tutoring_neighborhood ?? '',
    tutoring_teaching_mode: initialApplication?.tutoring_teaching_mode ?? 'both',
    tutoring_languages: initialApplication?.tutoring_languages ?? ['fr'],
    tutoring_rate_per_session: initialApplication?.tutoring_rate_per_session ?? undefined,
    tutoring_response_time_minutes: initialApplication?.tutoring_response_time_minutes ?? undefined,
    tutoring_whatsapp: initialApplication?.tutoring_whatsapp ?? '',
  });

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    if (application?.id) {
      fetchCredentials(application.id).then(setCredentials).catch(() => setCredentials([]));
    }
  }, [application?.id]);

  const hasGovernmentId = credentials.some((c) => c.credential_type === 'government_id');
  const hasSelfie = credentials.some((c) => c.credential_type === 'selfie');

  const persist = async (): Promise<InstructorApplication | null> => {
    if (!user) return null;
    const isFirstSave = !application?.id;
    setSaving(true);
    setError('');
    try {
      const saved = await saveDraft(user.id, form);
      setApplication(saved);
      if (isFirstSave) trackEvent('instructor_application_started');
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your progress');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const saved = await persist();
    if (saved) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleUpload = async (type: 'government_id' | 'degree' | 'certificate' | 'cv' | 'sample_lesson', file: File) => {
    if (!user || !application?.id) return;
    setUploadingType(type);
    setError('');
    try {
      const credential = await uploadCredential(user.id, application.id, type, file);
      setCredentials((prev) => [...prev, credential]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async () => {
    if (!application?.id) return;
    if (!hasGovernmentId) {
      setError('A government-issued ID is required before you can submit.');
      return;
    }
    if (!hasSelfie) {
      setError('A live selfie is required before you can submit.');
      return;
    }
    if (form.offers_tutoring) {
      if (!form.tutoring_category_ids || form.tutoring_category_ids.length === 0) {
        setError('Select at least one subject to tutor, or turn off tutoring above.');
        return;
      }
      if (!form.tutoring_neighborhood?.trim()) {
        setError('Add your neighborhood for tutoring, or turn off tutoring above.');
        return;
      }
      if (!form.tutoring_rate_per_session || form.tutoring_rate_per_session <= 0) {
        setError('Add your per-session tutoring rate, or turn off tutoring above.');
        return;
      }
      if (!form.tutoring_whatsapp || !isValidWhatsappContact(form.tutoring_whatsapp)) {
        setError('Add a valid WhatsApp number for tutoring (+237 6XX XXX XXX), or turn off tutoring above.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await submitApplication(application.id);
      trackEvent('instructor_application_submitted');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your application');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">Apply to teach</h1>
      <p className="text-gray-500 mb-8">
        Every applicant passes qualification, credential, identity and a compulsory
        interview review before their studio unlocks.
      </p>

      <ol className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
              i === step
                ? 'bg-primary-500 text-gray-900'
                : i < step
                ? 'bg-primary-50 text-primary-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i < step && <CheckCircle size={14} />}
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm mb-6">{error}</div>}

      <div className="rounded-[14px] border border-canvas-150 p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label="Full name">
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.full_name ?? ''}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label="Home address">
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, city, country"
              />
            </Field>
            <Field label="Headline (e.g. 'Backend engineer & Python instructor')">
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.headline ?? ''}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </Field>
            <Field label="Bio">
              <textarea
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                rows={4}
                value={form.bio ?? ''}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>
            <Field label="Qualifications (degrees, certifications, notable achievements)">
              <textarea
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                rows={3}
                value={form.qualifications ?? ''}
                onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Years of teaching / professional experience">
              <input
                type="number"
                min={0}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.years_experience ?? ''}
                onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })}
              />
            </Field>
            <Field label="Areas of expertise (comma-separated)">
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={(form.areas_of_expertise ?? []).join(', ')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    areas_of_expertise: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-primary-50 border border-primary-100 rounded-[10px] p-3.5 text-sm text-gray-700">
              This section is used only for matching you with parents looking for a private
              tutor for their child — it's completely optional and separate from your course.
              If you turn it on, please fill it in accurately: incomplete or incorrect
              information here means missed tutoring opportunities, since parents are matched
              automatically from what you enter.
            </div>

            <label className="flex items-center gap-2.5 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={form.offers_tutoring ?? false}
                onChange={(e) => setForm({ ...form, offers_tutoring: e.target.checked })}
                className="w-4 h-4"
              />
              I also want to be matched with parents for 1-on-1 tutoring
            </label>

            {form.offers_tutoring && (
              <>
                <Field label="Subjects you can tutor">
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const selected = (form.tutoring_category_ids ?? []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setForm((prev) => {
                              const current = prev.tutoring_category_ids ?? [];
                              return {
                                ...prev,
                                tutoring_category_ids: selected
                                  ? current.filter((id) => id !== c.id)
                                  : [...current, c.id],
                              };
                            })
                          }
                          className={`text-[13px] px-3 py-1.5 rounded-full border transition ${
                            selected ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Neighborhood (for in-person tutoring)">
                  <input
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_neighborhood ?? ''}
                    onChange={(e) => setForm({ ...form, tutoring_neighborhood: e.target.value })}
                    placeholder="e.g. Bonamoussadi"
                  />
                </Field>
                <Field label="Teaching mode">
                  <select
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_teaching_mode ?? 'both'}
                    onChange={(e) =>
                      setForm({ ...form, tutoring_teaching_mode: e.target.value as 'online' | 'in_person' | 'both' })
                    }
                  >
                    <option value="both">Online and in-person</option>
                    <option value="online">Online only</option>
                    <option value="in_person">In-person only</option>
                  </select>
                </Field>
                <Field label="Languages you can tutor in">
                  <div className="flex gap-1.5">
                    {(['fr', 'en'] as const).map((lang) => {
                      const selected = (form.tutoring_languages ?? []).includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`Language: ${lang === 'fr' ? 'French' : 'English'}`}
                          onClick={() =>
                            setForm((prev) => {
                              const current = prev.tutoring_languages ?? [];
                              return {
                                ...prev,
                                tutoring_languages: selected
                                  ? (current.filter((l) => l !== lang) as ('fr' | 'en')[])
                                  : ([...current, lang] as ('fr' | 'en')[]),
                              };
                            })
                          }
                          className={`text-[13px] px-3 py-1.5 rounded-full border transition ${
                            selected ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {lang === 'fr' ? 'French' : 'English'}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Rate per tutoring session (FCFA)">
                  <input
                    type="number"
                    min={0}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_rate_per_session ?? ''}
                    onChange={(e) => setForm({ ...form, tutoring_rate_per_session: Number(e.target.value) })}
                    placeholder="8000"
                  />
                </Field>
                <Field label="Usual response time">
                  <select
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_response_time_minutes ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tutoring_response_time_minutes: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">Not specified</option>
                    <option value={60}>Under 1 hour</option>
                    <option value={240}>1 to 4 hours</option>
                    <option value={1440}>More than 4 hours</option>
                  </select>
                </Field>
                <Field label="WhatsApp number for tutoring">
                  <input
                    type="tel"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_whatsapp ?? ''}
                    onChange={(e) => setForm({ ...form, tutoring_whatsapp: e.target.value })}
                    placeholder="+237 6XX XXX XXX"
                  />
                </Field>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Proposed course title">
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.proposed_course_title ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_title: e.target.value })}
              />
            </Field>
            <Field label="Proposed course description">
              <textarea
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                rows={4}
                value={form.proposed_course_description ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_description: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.proposed_course_category_id ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_category_id: e.target.value || null })}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Verify your identity with a document and a live selfie (both required), plus any
              degrees, certificates, a CV or a short sample lesson. Files are stored privately
              and only reviewers can access them.
            </p>

            {application?.id && (
              <IdentityCapture
                userId={user!.id}
                applicationId={application.id}
                fullName={form.full_name ?? ''}
                address={form.address ?? ''}
                credentials={credentials}
                onCredentialUploaded={(credential) => setCredentials((prev) => [...prev, credential])}
              />
            )}

            {(
              [
                ['degree', 'Degree'],
                ['certificate', 'Certificate'],
                ['cv', 'CV / résumé'],
                ['sample_lesson', 'Sample lesson'],
              ] as const
            ).map(([type, label]) => {
              const uploaded = credentials.filter((c) => c.credential_type === type);
              return (
                <div key={type} className="flex items-center justify-between border border-canvas-150 rounded-[10px] p-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{label}</p>
                    {uploaded.map((c) => (
                      <p key={c.id} className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <CheckCircle size={12} className="text-primary-600" /> {c.file_name}
                      </p>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-[10px] cursor-pointer">
                    <Upload size={14} />
                    {uploadingType === type ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      className="hidden"
                      disabled={!application?.id || uploadingType !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(type, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            {(() => {
              const calLink = getCalBookingLink(form.full_name ?? '', user?.email ?? '');
              return calLink ? (
                <>
                  <p className="text-sm text-gray-500">
                    Book your compulsory interview on Cal.com — pick any time that works for you.
                    A reviewer confirms it once your credentials and application have been checked.
                  </p>
                  <a
                    href={calLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block h-11 px-4 flex items-center rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 text-sm font-semibold"
                  >
                    Schedule interview on Cal.com
                  </a>
                  <p className="text-xs text-gray-500">
                    You can also submit now and schedule later from your dashboard.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Interview scheduling isn't configured yet — submit your application and
                  we'll follow up by email to schedule.
                </p>
              );
            })()}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <button
            onClick={goBack}
            disabled={step === 0 || saving}
            className="h-11 px-4 rounded-[10px] text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="h-11 px-6 rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & continue'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="h-11 px-6 rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 font-semibold disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ id?: string }> }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
