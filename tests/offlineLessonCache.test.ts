import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheLessonForOffline, getCachedLesson } from '../lib/offlineLessonCache';

describe('offlineLessonCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for a lesson that was never cached', () => {
    expect(getCachedLesson('never-seen')).toBeNull();
  });

  it('caches and retrieves a lesson', () => {
    cacheLessonForOffline({ id: 'lesson-1', courseId: 'course-1', title: 'Intro', content: 'Some text' });

    const cached = getCachedLesson('lesson-1');
    expect(cached?.title).toBe('Intro');
    expect(cached?.content).toBe('Some text');
    expect(cached?.courseId).toBe('course-1');
  });

  it('overwrites a lesson cached twice with the latest content', () => {
    cacheLessonForOffline({ id: 'lesson-1', courseId: 'course-1', title: 'Intro', content: 'Old text' });
    cacheLessonForOffline({ id: 'lesson-1', courseId: 'course-1', title: 'Intro', content: 'New text' });

    expect(getCachedLesson('lesson-1')?.content).toBe('New text');
  });

  // Regression: an unbounded cache would grow forever for a long-time
  // user -- LRU-evicts down to 20 entries, oldest (by cachedAt) dropped first.
  it('evicts the oldest entry once more than 20 lessons are cached', () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    for (let i = 0; i < 20; i++) {
      cacheLessonForOffline({ id: `lesson-${i}`, courseId: 'course-1', title: `Lesson ${i}`, content: 'text' });
      vi.advanceTimersByTime(1000);
    }

    expect(getCachedLesson('lesson-0')).not.toBeNull();

    // The 21st insert should evict lesson-0 (the oldest).
    cacheLessonForOffline({ id: 'lesson-20', courseId: 'course-1', title: 'Lesson 20', content: 'text' });

    expect(getCachedLesson('lesson-0')).toBeNull();
    expect(getCachedLesson('lesson-20')).not.toBeNull();
    expect(getCachedLesson('lesson-19')).not.toBeNull();

    vi.useRealTimers();
  });
});
