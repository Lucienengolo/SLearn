import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Camera, Upload, AlertTriangle } from 'lucide-react';
import { supabase, InstructorCredential } from '../../../lib/supabase';
import { uploadCredential } from '../../../lib/instructorApplications';

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

// Guided document + live-selfie capture for the compulsory identity check,
// replacing the plain file-upload government_id row (inspired by
// fortnight-space's step structure: document upload, then a live camera
// selfie -- see verify-identity-document for why the actual verification
// here is Claude-vision extraction + a name/address cross-check rather
// than fortnight-space's local ArcFace face-matching, which needs ML
// infra that doesn't run in a Deno edge function or a browser).
export default function IdentityCapture({
  userId,
  applicationId,
  fullName,
  address,
  credentials,
  onCredentialUploaded,
}: IdentityCaptureProps) {
  const governmentId = credentials.find((c) => c.credential_type === 'government_id');
  const selfie = credentials.find((c) => c.credential_type === 'selfie');

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runVerification = async () => {
    setVerifying(true);
    setVerifyError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-identity-document', {
        body: { applicationId },
      });
      if (error) {
        setVerifyError('Could not verify the document automatically — a reviewer will check it manually.');
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
      setDocError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const openCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraOpen(true);
      // Wait for the <video> element to mount before attaching the stream.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError('Could not access your camera. Check your browser permissions and try again.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;

    closeCamera();
    setUploadingSelfie(true);
    try {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      const credential = await uploadCredential(userId, applicationId, 'selfie', file);
      onCredentialUploaded(credential);
    } finally {
      setUploadingSelfie(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-gray-800 text-sm">Government-issued ID (required)</p>
          {governmentId && (
            <label className="flex items-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg cursor-pointer">
              <Upload size={12} />
              Replace
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
          <p className="text-xs text-gray-500 mb-3">A national ID, passport, or driver's license. JPG or PNG.</p>
        )}
        {!governmentId && (
          <label className="inline-flex items-center gap-2 text-sm bg-primary-500 text-gray-900 hover:bg-primary-400 px-4 py-2 rounded-lg cursor-pointer font-medium">
            <Upload size={14} />
            {uploadingDoc ? 'Uploading…' : 'Upload document'}
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

        {verifying && <p className="text-xs text-gray-500 mt-2">Checking document details…</p>}
        {verifyError && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <AlertTriangle size={12} /> {verifyError}
          </p>
        )}
        {verification && (
          <div className="mt-3 text-xs bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700">Automated check (not a final decision — a reviewer confirms):</p>
            <MatchRow label="Name" typed={fullName} extracted={verification.extracted_name} match={verification.name_match} />
            <MatchRow label="Address" typed={address} extracted={verification.extracted_address} match={verification.address_match} />
            {verification.notes && <p className="text-gray-500 italic mt-1">{verification.notes}</p>}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <p className="font-medium text-gray-800 text-sm mb-1">Live selfie (required)</p>
        {selfie ? (
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 mb-2">
            <CheckCircle size={12} className="text-primary-600" /> Captured
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-3">
            A live photo via your camera — reviewers compare this to your ID visually.
          </p>
        )}

        {cameraError && <p className="text-xs text-red-600 mb-2">{cameraError}</p>}

        {cameraOpen ? (
          <div className="space-y-2">
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-xs rounded-lg bg-black" />
            <div className="flex gap-2">
              <button
                onClick={captureSelfie}
                className="flex items-center gap-2 bg-primary-500 text-gray-900 hover:bg-primary-400 px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Camera size={14} />
                Capture
              </button>
              <button
                onClick={closeCamera}
                className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openCamera}
            disabled={uploadingSelfie}
            className="inline-flex items-center gap-2 text-sm bg-primary-500 text-gray-900 hover:bg-primary-400 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            <Camera size={14} />
            {uploadingSelfie ? 'Uploading…' : selfie ? 'Retake selfie' : 'Open camera'}
          </button>
        )}
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
  if (!extracted) {
    return (
      <p className="text-gray-500">
        {label}: not clearly visible on the document — a reviewer will confirm manually.
      </p>
    );
  }
  return (
    <p className={match ? 'text-primary-700' : 'text-red-600'}>
      {match ? '✓' : '⚠'} {label}: document shows "{extracted}" — {match ? 'matches' : 'does not clearly match'} "{typed}"
    </p>
  );
}
