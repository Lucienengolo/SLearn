import { useState, useEffect } from 'react';
import { Headphones, PlayCircle } from 'lucide-react';
import { Lesson } from '../../lib/supabase';

type LowBandwidthVideoPlayerProps = {
  lesson: Pick<Lesson, 'id' | 'video_file_url' | 'video_url'>;
  lowBandwidthMode: boolean;
};

// Extracted from LessonViewer.tsx so the actual low-bandwidth-mode decision
// (banner vs. audio vs. video) is testable without dragging in LessonViewer's
// large data-fetching surface (courses/progress/quizzes/certificates).
// CEO plan item 8: detect slow connection, offer audio-only/PDF fallback --
// explicitly NOT real adaptive bitrate streaming (no transcoding pipeline).
// <audio src={video_file_url}> plays a self-hosted MP4's audio track
// directly without decoding video frames -- real CPU/battery savings and
// smoother buffering on a slow link, even though the byte download is the
// same file (there's no separate audio-only asset without a transcode step).
export default function LowBandwidthVideoPlayer({ lesson, lowBandwidthMode }: LowBandwidthVideoPlayerProps) {
  const [videoRevealed, setVideoRevealed] = useState(false);
  const [audioMode, setAudioMode] = useState(false);

  // Reset per-lesson so navigating to a new lesson doesn't carry over a
  // "video revealed" choice made on the previous one.
  useEffect(() => {
    setVideoRevealed(false);
    setAudioMode(false);
  }, [lesson.id]);

  if (!lesson.video_file_url && !lesson.video_url) return null;

  if (lowBandwidthMode && !videoRevealed && !audioMode) {
    return (
      <div className="rounded-[14px] border border-canvas-150 bg-gray-50 p-5 mb-5">
        <p className="text-sm font-semibold text-gray-900 mb-1">Mode faible bande passante activé</p>
        <p className="text-sm text-gray-600 mb-4">
          La vidéo est masquée pour économiser vos données. Utilisez les notes PDF ci-dessous, ou choisissez une
          option :
        </p>
        <div className="flex flex-wrap gap-2">
          {lesson.video_file_url && (
            <button
              onClick={() => setAudioMode(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-[10px] h-9 px-3.5 hover:bg-white transition"
            >
              <Headphones size={15} />
              Écouter (audio seulement)
            </button>
          )}
          <button
            onClick={() => setVideoRevealed(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-[10px] h-9 px-3.5 hover:bg-white transition"
          >
            <PlayCircle size={15} />
            Regarder la vidéo quand même
          </button>
        </div>
      </div>
    );
  }

  if (audioMode && lesson.video_file_url) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-4 mb-5">
        <audio controls className="w-full" src={lesson.video_file_url} />
        <button
          onClick={() => {
            setAudioMode(false);
            setVideoRevealed(true);
          }}
          className="text-2xs text-gray-500 hover:text-gray-800 transition mt-2"
        >
          Passer en mode vidéo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] overflow-hidden bg-black mb-5">
      {lesson.video_file_url ? (
        <video controls className="w-full h-auto" src={lesson.video_file_url} />
      ) : (
        <div className="aspect-video">
          <iframe
            src={lesson.video_url!}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  );
}
