import { useState, useEffect } from 'react';
import { Award, Download, ArrowLeft } from 'lucide-react';
import { supabase, Certificate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type CertificatesPageProps = {
  onBack: () => void;
};

type CertificateWithCourse = Certificate & {
  course: { title: string; instructor: { full_name: string } };
};

export default function CertificatesPage({ onBack }: CertificatesPageProps) {
  const { user, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertificates();
  }, [user]);

  const fetchCertificates = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('certificates')
      .select(`
        *,
        course:courses(
          title,
          instructor:profiles!instructor_id(full_name)
        )
      `)
      .eq('student_id', user.id)
      .order('issued_at', { ascending: false });

    if (data) setCertificates(data);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
      >
        <ArrowLeft size={16} />
        <span>Back to dashboard</span>
      </button>

      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-gray-900">My certificates</h1>
        <p className="text-gray-500 mt-1">View and download your course completion certificates</p>
      </div>

      {certificates.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Award size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">No certificates yet</h3>
          <p className="text-gray-500 text-sm">Complete courses to earn certificates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="rounded-[14px] border border-canvas-150 overflow-hidden hover:shadow-md transition"
            >
              <div
                className="p-6 text-white"
                style={{ background: 'linear-gradient(135deg,#E2A52A,#A66E13)' }}
              >
                <Award size={40} className="mb-3" />
                <h2 className="font-display text-2xl mb-1">Certificate of Completion</h2>
                <p className="text-white/85 text-sm">S@Learn Online Learning Platform</p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-0.5">This certifies that</p>
                  <p className="text-xl font-semibold text-gray-900">{profile?.full_name || user?.email}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-0.5">has successfully completed</p>
                  <p className="text-lg font-semibold text-gray-900">{certificate.course.title}</p>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-0.5">Instructor</p>
                  <p className="text-gray-800">{certificate.course.instructor.full_name}</p>
                </div>

                <div className="border-t border-canvas-150 pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">Issue date</p>
                      <p className="font-medium text-gray-900">{formatDate(certificate.issued_at)}</p>
                    </div>
                    <button className="flex items-center gap-1.5 bg-primary-500 text-gray-900 rounded-[10px] h-10 px-4 hover:bg-primary-400 transition font-medium">
                      <Download size={16} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-canvas-150">
                  <p className="text-2xs text-gray-400">Certificate ID: {certificate.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
