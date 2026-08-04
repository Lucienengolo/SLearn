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
import { useLocale } from '../../../contexts/LocaleContext';
import type { TranslationKey } from '../../../lib/i18n';

const STEP_KEYS: TranslationKey[] = [
  'dashboard.instructorApplication.stepProfile',
  'dashboard.instructorApplication.stepExperience',
  'dashboard.instructorApplication.stepTutoring',
  'dashboard.instructorApplication.stepCourseProposal',
  'dashboard.instructorApplication.stepCredentialsIdentity',
  'dashboard.instructorApplication.stepInterviewScheduling',
];

type Props = {
  initialApplication: InstructorApplication | null;
  onSubmitted: () => void;
};

// Bug report, 2026-08-04: "when you submit or do something like that it
// pushes you out of the registration process, you have to start back from
// the beginning although the information remains on the different form".
// Root cause: this wizard's `step` is local component state, so it always
// resets to 0 on mount -- and InstructorApplicationFlow (the parent)
// really does remount it fresh on every page load/refresh/navigation back
// to "Apply to teach", even though it correctly refetches the real saved
// application + credentials each time (saveDraft upserts one row per
// applicant; nothing was ever actually lost). The form fields/uploaded
// documents (including a submitted CV) were never the problem -- the user
// just had to click through every prior step again to see them, which
// reads exactly like "I have to start over." Persisting the step position
// itself (founder's own suggested fix: "save the progress locally") closes
// the actual gap.
const STEP_STORAGE_KEY_PREFIX = 'slearn:instructorApplicationStep:';

function readStoredStep(userId: string | undefined): number {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(STEP_STORAGE_KEY_PREFIX + userId);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), STEP_KEYS.length - 1);
  } catch {
    // Private browsing / storage disabled -- resuming at step 0 on a
    // future remount is a minor inconvenience, not worth blocking on.
    return 0;
  }
}

function writeStoredStep(userId: string | undefined, step: number) {
  if (!userId) return;
  try {
    localStorage.setItem(STEP_STORAGE_KEY_PREFIX + userId, String(step));
  } catch {
    // Same as above -- non-fatal.
  }
}

function clearStoredStep(userId: string | undefined) {
  if (!userId) return;
  try {
    localStorage.removeItem(STEP_STORAGE_KEY_PREFIX + userId);
  } catch {
    // Non-fatal.
  }
}

export default function ApplicationWizard({ initialApplication, onSubmitted }: Props) {
  const { t } = useLocale();
  const { user } = useAuth();
  const [application, setApplication] = useState<InstructorApplication | null>(initialApplication);
  const [step, setStep] = useState(() => readStoredStep(user?.id));
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
    writeStoredStep(user?.id, step);
  }, [step, user?.id]);

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
  const hasCV = credentials.some((c) => c.credential_type === 'cv');
  const hasSampleLesson = credentials.some((c) => c.credential_type === 'sample_lesson');
  const hasQuestionPaper = credentials.some((c) => c.credential_type === 'question_paper');

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
      setError(err instanceof Error ? err.message : t('dashboard.instructorApplication.couldNotSaveProgress'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const saved = await persist();
    if (saved) setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleUpload = async (
    type: 'government_id' | 'degree' | 'certificate' | 'cv' | 'sample_lesson' | 'question_paper',
    file: File
  ) => {
    if (!user || !application?.id) return;
    setUploadingType(type);
    setError('');
    try {
      const credential = await uploadCredential(user.id, application.id, type, file);
      setCredentials((prev) => [...prev, credential]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.instructorApplication.uploadFailed'));
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async () => {
    if (!application?.id) return;
    if (!hasGovernmentId) {
      setError(t('dashboard.instructorApplication.govIdRequiredError'));
      return;
    }
    if (!hasCV) {
      setError(t('dashboard.instructorApplication.cvRequiredError'));
      return;
    }
    if (!hasSampleLesson) {
      setError(t('dashboard.instructorApplication.sampleLessonRequiredError'));
      return;
    }
    if (!hasQuestionPaper) {
      setError(t('dashboard.instructorApplication.questionPaperRequiredError'));
      return;
    }
    if (form.offers_tutoring) {
      if (!form.tutoring_category_ids || form.tutoring_category_ids.length === 0) {
        setError(t('dashboard.instructorApplication.selectSubjectError'));
        return;
      }
      if (!form.tutoring_neighborhood?.trim()) {
        setError(t('dashboard.instructorApplication.addNeighborhoodError'));
        return;
      }
      if (!form.tutoring_rate_per_session || form.tutoring_rate_per_session <= 0) {
        setError(t('dashboard.instructorApplication.addRateError'));
        return;
      }
      if (!form.tutoring_whatsapp || !isValidWhatsappContact(form.tutoring_whatsapp)) {
        setError(t('dashboard.instructorApplication.addWhatsappError'));
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await submitApplication(application.id);
      trackEvent('instructor_application_submitted');
      clearStoredStep(user?.id);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.instructorApplication.couldNotSubmit'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.student.applyToTeach')}</h1>
      <p className="text-gray-500 mb-8">
        {t('dashboard.instructorApplication.wizardSubtitle')}
      </p>

      <ol className="flex flex-wrap gap-2 mb-8">
        {STEP_KEYS.map((labelKey, i) => (
          <li
            key={labelKey}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
              i === step
                ? 'bg-primary-500 text-gray-900'
                : i < step
                ? 'bg-primary-50 text-primary-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i < step && <CheckCircle size={14} />}
            {i + 1}. {t(labelKey)}
          </li>
        ))}
      </ol>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm mb-6">{error}</div>}

      <div className="rounded-[14px] border border-canvas-150 p-4 sm:p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label={t('dashboard.instructorApplication.fullNameLabel')}>
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.full_name ?? ''}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label={t('dashboard.instructorApplication.homeAddressLabel')}>
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t('dashboard.instructorApplication.addressPlaceholder')}
              />
            </Field>
            <Field label={t('dashboard.instructorApplication.headlineLabel')}>
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.headline ?? ''}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </Field>
            <Field label={t('dashboard.reviewQueue.bioLabel')}>
              <textarea
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                rows={4}
                value={form.bio ?? ''}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>
            <Field label={t('dashboard.instructorApplication.qualificationsFullLabel')}>
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
            <Field label={t('dashboard.instructorApplication.yearsExperienceLabel')}>
              <input
                type="number"
                min={0}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.years_experience ?? ''}
                onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('dashboard.instructorApplication.areasExpertiseCommaLabel')}>
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
              {t('dashboard.instructorApplication.tutoringIntro')}
            </div>

            <label className="flex items-center gap-2.5 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={form.offers_tutoring ?? false}
                onChange={(e) => setForm({ ...form, offers_tutoring: e.target.checked })}
                className="w-4 h-4"
              />
              {t('dashboard.instructorApplication.wantTutoringCheckbox')}
            </label>

            {form.offers_tutoring && (
              <>
                <Field label={t('dashboard.instructorApplication.subjectsToTutorLabel')}>
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
                <Field label={t('dashboard.instructorApplication.neighborhoodLabel')}>
                  <input
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_neighborhood ?? ''}
                    onChange={(e) => setForm({ ...form, tutoring_neighborhood: e.target.value })}
                    placeholder={t('dashboard.instructorApplication.neighborhoodPlaceholder')}
                  />
                </Field>
                <Field label={t('dashboard.instructorApplication.teachingModeLabel')}>
                  <select
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_teaching_mode ?? 'both'}
                    onChange={(e) =>
                      setForm({ ...form, tutoring_teaching_mode: e.target.value as 'online' | 'in_person' | 'both' })
                    }
                  >
                    <option value="both">{t('dashboard.instructorApplication.onlineInPerson')}</option>
                    <option value="online">{t('dashboard.instructorApplication.onlineOnly')}</option>
                    <option value="in_person">{t('dashboard.instructorApplication.inPersonOnly')}</option>
                  </select>
                </Field>
                <Field label={t('dashboard.instructorApplication.languagesTutorLabel')}>
                  <div className="flex gap-1.5">
                    {(['fr', 'en'] as const).map((lang) => {
                      const selected = (form.tutoring_languages ?? []).includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${t('dashboard.instructorApplication.languageAriaPrefix')} ${lang === 'fr' ? t('dashboard.instructorApplication.french') : t('dashboard.instructorApplication.english')}`}
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
                          {lang === 'fr' ? t('dashboard.instructorApplication.french') : t('dashboard.instructorApplication.english')}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label={t('dashboard.instructorApplication.ratePerSessionLabel')}>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    value={form.tutoring_rate_per_session ?? ''}
                    onChange={(e) => setForm({ ...form, tutoring_rate_per_session: Number(e.target.value) })}
                    placeholder="8000"
                  />
                </Field>
                <Field label={t('dashboard.instructorApplication.responseTimeLabel')}>
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
                    <option value="">{t('dashboard.instructorApplication.notSpecified')}</option>
                    <option value={60}>{t('dashboard.instructorApplication.underOneHour')}</option>
                    <option value={240}>{t('dashboard.instructorApplication.oneToFourHours')}</option>
                    <option value={1440}>{t('dashboard.instructorApplication.moreThanFourHours')}</option>
                  </select>
                </Field>
                <Field label={t('dashboard.instructorApplication.whatsappNumberLabel')}>
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
            <Field label={t('dashboard.instructorApplication.proposedCourseTitleLabel')}>
              <input
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.proposed_course_title ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_title: e.target.value })}
              />
            </Field>
            <Field label={t('dashboard.instructorApplication.proposedCourseDescLabel')}>
              <textarea
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                rows={4}
                value={form.proposed_course_description ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_description: e.target.value })}
              />
            </Field>
            <Field label={t('dashboard.courseEditor.categoryLabel')}>
              <select
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                value={form.proposed_course_category_id ?? ''}
                onChange={(e) => setForm({ ...form, proposed_course_category_id: e.target.value || null })}
              >
                <option value="">{t('dashboard.courseEditor.selectCategory')}</option>
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
              {t('dashboard.instructorApplication.credentialsIntro')}
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
                ['degree', 'dashboard.instructorApplication.degreeLabel'],
                ['certificate', 'dashboard.instructorApplication.certificateLabel'],
                ['cv', 'dashboard.instructorApplication.cvLabel'],
                ['sample_lesson', 'dashboard.instructorApplication.sampleLessonLabel'],
                ['question_paper', 'dashboard.instructorApplication.questionPaperLabel'],
              ] as const
            ).map(([type, labelKey]) => {
              const uploaded = credentials.filter((c) => c.credential_type === type);
              return (
                <div key={type} className="flex items-center justify-between border border-canvas-150 rounded-[10px] p-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{t(labelKey)}</p>
                    {uploaded.map((c) => (
                      <p key={c.id} className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <CheckCircle size={12} className="text-primary-600" /> {c.file_name}
                      </p>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-[10px] cursor-pointer">
                    <Upload size={14} />
                    {uploadingType === type ? t('dashboard.courseEditor.uploadingEllipsis') : t('dashboard.instructorApplication.upload')}
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
                    {t('dashboard.instructorApplication.bookInterviewIntro')}
                  </p>
                  <a
                    href={calLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block h-11 px-4 flex items-center rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 text-sm font-semibold"
                  >
                    {t('dashboard.instructorApplication.scheduleInterviewCal')}
                  </a>
                  <p className="text-xs text-gray-500">
                    {t('dashboard.instructorApplication.submitLaterNote')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  {t('dashboard.instructorApplication.interviewNotConfigured')}
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
            {t('dashboard.instructorApplication.back')}
          </button>
          {step < STEP_KEYS.length - 1 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="h-11 px-6 rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 font-semibold disabled:opacity-50"
            >
              {saving ? t('dashboard.courseEditor.savingEllipsis') : t('dashboard.instructorApplication.saveContinue')}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="h-11 px-6 rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 font-semibold disabled:opacity-50"
            >
              {saving ? t('dashboard.instructorApplication.submittingEllipsis') : t('dashboard.instructorApplication.submitApplication')}
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
