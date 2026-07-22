import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LowBandwidthVideoPlayer from '../components/Lessons/LowBandwidthVideoPlayer';

const LESSON_WITH_FILE = { id: 'lesson-1', video_file_url: 'https://cdn.example.com/lesson.mp4', video_url: null };
const LESSON_WITH_EMBED = { id: 'lesson-2', video_file_url: null, video_url: 'https://youtube.com/embed/xyz' };
const LESSON_WITHOUT_VIDEO = { id: 'lesson-3', video_file_url: null, video_url: null };

describe('LowBandwidthVideoPlayer', () => {
  it('renders nothing when the lesson has no video at all', () => {
    const { container } = render(<LowBandwidthVideoPlayer lesson={LESSON_WITHOUT_VIDEO} lowBandwidthMode={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the video directly when low-bandwidth mode is off', () => {
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={false} />);
    expect(document.querySelector('video')).toHaveAttribute('src', LESSON_WITH_FILE.video_file_url);
    expect(screen.queryByText(/mode faible bande passante/i)).not.toBeInTheDocument();
  });

  it('hides the video behind a banner when low-bandwidth mode is on', () => {
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={true} />);
    expect(screen.getByText(/mode faible bande passante activé/i)).toBeInTheDocument();
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it('only offers the audio-only option for a self-hosted file, not an embed', () => {
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_EMBED} lowBandwidthMode={true} />);
    expect(screen.getByText(/mode faible bande passante activé/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /écouter/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regarder la vidéo quand même/i })).toBeInTheDocument();
  });

  it('reveals the video when "watch anyway" is clicked', async () => {
    const user = userEvent.setup();
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={true} />);

    await user.click(screen.getByRole('button', { name: /regarder la vidéo quand même/i }));

    expect(document.querySelector('video')).toBeInTheDocument();
    expect(screen.queryByText(/mode faible bande passante activé/i)).not.toBeInTheDocument();
  });

  it('plays audio-only through an <audio> element when chosen, not <video>', async () => {
    const user = userEvent.setup();
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={true} />);

    await user.click(screen.getByRole('button', { name: /écouter \(audio seulement\)/i }));

    const audio = document.querySelector('audio');
    expect(audio).toHaveAttribute('src', LESSON_WITH_FILE.video_file_url);
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it('actually switches to video (matching its label) when leaving audio mode', async () => {
    const user = userEvent.setup();
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={true} />);

    await user.click(screen.getByRole('button', { name: /écouter \(audio seulement\)/i }));
    expect(document.querySelector('audio')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /passer en mode vidéo/i }));

    expect(document.querySelector('video')).toBeInTheDocument();
    expect(document.querySelector('audio')).not.toBeInTheDocument();
  });

  it('resets the revealed/audio choice when the lesson changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_FILE} lowBandwidthMode={true} />);

    await user.click(screen.getByRole('button', { name: /regarder la vidéo quand même/i }));
    expect(document.querySelector('video')).toBeInTheDocument();

    const nextLesson = { id: 'lesson-4', video_file_url: 'https://cdn.example.com/other.mp4', video_url: null };
    rerender(<LowBandwidthVideoPlayer lesson={nextLesson} lowBandwidthMode={true} />);

    expect(screen.getByText(/mode faible bande passante activé/i)).toBeInTheDocument();
  });

  it('renders the iframe embed path (not video/audio) when there is no self-hosted file', () => {
    render(<LowBandwidthVideoPlayer lesson={LESSON_WITH_EMBED} lowBandwidthMode={false} />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toHaveAttribute('src', LESSON_WITH_EMBED.video_url);
  });
});
