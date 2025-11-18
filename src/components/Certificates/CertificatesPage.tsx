import { useState, useEffect } from 'react';
import { Award, Download, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type CertificatesPageProps = {
  onBack: () => void;
};

export default function CertificatesPage({ onBack }: CertificatesPageProps) {
  const { user, profile } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
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
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Certificates</h1>
        <p className="text-gray-600 mt-1">View and download your course completion certificates</p>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Award size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No certificates yet</h3>
          <p className="text-gray-600">Complete courses to earn certificates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition"
            >
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
                <Award size={48} className="mb-4" />
                <h2 className="text-2xl font-bold mb-2">Certificate of Completion</h2>
                <p className="text-blue-100">S@Learn Online Learning Platform</p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">This certifies that</p>
                  <p className="text-xl font-bold text-gray-800">{profile?.full_name || user?.email}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">has successfully completed</p>
                  <p className="text-lg font-semibold text-gray-800">{certificate.course.title}</p>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-1">Instructor</p>
                  <p className="text-gray-800">{certificate.course.instructor.full_name}</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Issue Date</p>
                      <p className="font-medium text-gray-800">{formatDate(certificate.issued_at)}</p>
                    </div>
                    <button className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
                      <Download size={18} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">Certificate ID: {certificate.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
