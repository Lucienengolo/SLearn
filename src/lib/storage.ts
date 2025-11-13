import { supabase } from './supabase';

export const uploadLessonVideo = async (
  courseId: string,
  lessonId: string,
  file: File
): Promise<string | null> => {
  try {
    const fileName = `${courseId}/${lessonId}/video-${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from('lesson-videos')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading video:', error);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Error uploading video:', error);
    return null;
  }
};

export const uploadLessonPDF = async (
  courseId: string,
  lessonId: string,
  file: File
): Promise<string | null> => {
  try {
    const fileName = `${courseId}/${lessonId}/notes-${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from('lesson-pdfs')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading PDF:', error);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from('lesson-pdfs')
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return null;
  }
};

export const deleteLessonVideo = async (videoUrl: string): Promise<boolean> => {
  try {
    const path = videoUrl.split('/storage/v1/object/public/lesson-videos/')[1];
    if (!path) return false;

    const { error } = await supabase.storage
      .from('lesson-videos')
      .remove([path]);

    if (error) {
      console.error('Error deleting video:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting video:', error);
    return false;
  }
};

export const deleteLessonPDF = async (pdfUrl: string): Promise<boolean> => {
  try {
    const path = pdfUrl.split('/storage/v1/object/public/lesson-pdfs/')[1];
    if (!path) return false;

    const { error } = await supabase.storage
      .from('lesson-pdfs')
      .remove([path]);

    if (error) {
      console.error('Error deleting PDF:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting PDF:', error);
    return false;
  }
};

export const getFileNameFromUrl = (url: string): string => {
  try {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return 'File';
  }
};
