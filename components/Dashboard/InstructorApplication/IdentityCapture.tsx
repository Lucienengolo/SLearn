import { useState } from 'react';
import { CheckCircle, Camera, Upload, AlertTriangle } from 'lucide-react';
import { supabase, InstructorCredential } from '../../../lib/supabase';
import { uploadCredential } from '../../../lib/instructorApplications';
import { useLocale } from '../../../contexts/LocaleContext';

type VerificationResult = {
  extracted_name: string | null;
  extracted_address: string | null;
  name_match: boolean | null;
  address_match: boolean | null;
  notes: string | null;
};

type IdentityCaptureProps = {
  userId: string;
  applicationId: string;
  fullName: string;
  address: string;
  credentials: InstructorCredential[];
  onCredentialUploaded: (credential: InstructorCredential) => void;
};

// Guided document + selfie upload for the compulsory identity check,
// replacing the plain file-upload government_id row (inspired by
// fortnight-space's step structure: document upload, then a selfie --
// see verify-identity-document for why the actual verification here is
// Claude-vision extraction + a name/address cross-check rather than
// fortnight-space's local ArcFace face-matching, which needs ML infra
// that doesn't run in a Deno edge function or a browser).
//
// The selfie was originally captured live in-browser via
// navigator.mediaDevices.getUserMedia(), same as the geolocation feature
// -- and it hit the same real-world failure mode: getUserMedia is
// routinely blocked or simply unavailable in in-app WebViews (WhatsApp,
// Instagram, etc.), which is how a meaningful share of this app's users
// actually arrive. Switched to a plain file input (2026-08-04) --
// mirrors the government_id upload below exactly, just with
// capture="user" (front camera hint) instead of "environment".
//
// The selfie itself became optional the same day (founder request,
// alongside making degree/certificate optional and CV/sample-lesson/
// question-paper compulsory -- see ApplicationWizard.tsx's handleSubmit
// for the actual enforcement). verify-identity-document only ever
// processes government_id automatically either way; a submitted selfie
// still helps a reviewer visually cross-check it against the ID, it's
// just no longer a submission blocker.
export default function IdentityCapture({
  userId,
  applicationId,
  fullName,
  address,
  credentials,
  onCredentialUploaded,
}: IdentityCaptureProps) {
  const { t } = useLocale();
  const governmentId = credentials.find((c) => c.credential_type === 'government_id');
  const selfie = credentials.find((c) => c.credential_type === 'selfie');

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState('');

  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const runVerification = async () => {
    setVerifying(true);
    setVerifyError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-identity-document', {
        body: { applicationId },
      });
      if (error) {
        setVerifyError(t('dashboard.instructorApplication.couldNotVerifyAuto'));
        return;
      }
      setVerification(data as VerificationResult);
    } finally {
      setVerifying(false);
    }
  };

  const handleDocUpload = async (file: File) => {
    setUploadingDoc(true);
    setDocError('');
    try {
      const credential = await uploadCredential(userId, applicationId, 'government_id', file);
      onCredentialUploaded(credential);
      await runVerification();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : t('dashboard.instructorApplication.uploadFailed'));
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSelfieUpload = async (file: File) => {
    setUploadingSelfie(true);
    setSelfieError('');
    try {
      const credential = await uploadCredential(userId, applicationId, 'selfie', file);
      onCredentialUploaded(credential);
    } catch (err) {
      setSelfieError(err instanceof Error ? err.message : t('dashboard.instructorApplication.uploadFailed'));
    } finally {
      setUploadingSelfie(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-canvas-150 rounded-[10px] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-gray-800 text-sm">{t('dashboard.instructorApplication.governmentIdRequired')}</p>
          {governmentId && (
            <label className="flex items-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-[10px] cursor-pointer">
              <Upload size={12} />
              {t('dashboard.instructorApplication.replace')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploadingDoc}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        {governmentId ? (
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 mb-2">
            <CheckCircle size={12} className="text-primary-600" /> {governmentId.file_name}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-3">{t('dashboard.instructorApplication.idHint')}</p>
        )}
        {!governmentId && (
          <label className="inline-flex items-center gap-2 text-sm bg-primary-500 text-gray-900 hover:bg-primary-400 px-4 py-2 rounded-[10px] cursor-pointer font-medium">
            <Upload size={14} />
            {uploadingDoc ? t('dashboard.courseEditor.uploadingEllipsis') : t('dashboard.instructorApplication.uploadDocument')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploadingDoc}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDocUpload(file);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {docError && <p className="text-xs text-red-600 mt-2">{docError}</p>}

        {verifying && <p className="text-xs text-gray-500 mt-2">{t('dashboard.instructorApplication.checkingDocumentDetails')}</p>}
        {verifyError && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <AlertTriangle size={12} /> {verifyError}
          </p>
        )}
        {verification && (
          <div className="mt-3 text-xs bg-gray-50 rounded-[10px] p-3 space-y-1">
            <p className="font-medium text-gray-700">{t('dashboard.instructorApplication.automatedCheckNote')}</p>
            <MatchRow label={t('dashboard.instructorApplication.nameFieldLabel')} typed={fullName} extracted={verification.extracted_name} match={verification.name_match} />
            <MatchRow label={t('dashboard.reviewQueue.addressFieldLabel')} typed={address} extracted={verification.extracted_address} match={verification.address_match} />
            {verification.notes && <p className="text-gray-500 italic mt-1">{verification.notes}</p>}
          </div>
        )}
      </div>

      <div className="border border-canvas-150 rounded-[10px] p-3 sm:p-4">
        <p className="font-medium text-gray-800 text-sm mb-1">{t('dashboard.instructorApplication.selfieLabel')}</p>
        {selfie ? (
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 mb-2">
            <CheckCircle size={12} className="text-primary-600" /> {t('dashboard.instructorApplication.captured')}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-3">
            {t('dashboard.instructorApplication.selfieHint')}
          </p>
        )}

        {selfieError && <p className="text-xs text-red-600 mb-2">{selfieError}</p>}

        <label className="inline-flex items-center gap-2 text-sm bg-primary-500 text-gray-900 hover:bg-primary-400 px-4 py-2 rounded-[10px] cursor-pointer font-medium">
          <Camera size={14} />
          {uploadingSelfie ? t('dashboard.courseEditor.uploadingEllipsis') : selfie ? t('dashboard.instructorApplication.retakeSelfie') : t('dashboard.instructorApplication.uploadSelfie')}
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            disabled={uploadingSelfie}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSelfieUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}

function MatchRow({
  label,
  typed,
  extracted,
  match,
}: {
  label: string;
  typed: string;
  extracted: string | null;
  match: boolean | null;
}) {
  const { t } = useLocale();
  if (!extracted) {
    return (
      <p className="text-gray-500">
        {label}: {t('dashboard.instructorApplication.notClearlyVisible')}
      </p>
    );
  }
  return (
    <p className={match ? 'text-primary-700' : 'text-red-600'}>
      {match ? '✓' : '⚠'} {label}: {t('dashboard.instructorApplication.documentShows')} "{extracted}" — {match ? t('dashboard.instructorApplication.matches') : t('dashboard.instructorApplication.doesNotClearlyMatch')} "{typed}"
    </p>
  );
}
