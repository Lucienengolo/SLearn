// Lesson-content cache for offline review (founder request, 2026-08-01).
// Caches only the lesson's text `content` -- not video/PDF (just Storage
// URLs; actual offline playback needs the Cache API/a service worker,
// ruled out of scope) and not the quiz (QuizViewer.tsx does its own
// separate live fetch of quiz_questions, untouched by this feature, so a
// cached Quiz row alone couldn't make quiz-taking work offline anyway --
// caching it would have been a promise this code can't keep). This is
// "review what you already read," not "do everything offline."
const CACHE_STORAGE_KEY = 'slearn_offline_lessons_v1';
const MAX_CACHED_LESSONS = 20;

export type CachedLesson = {
  id: string;
  courseId: string;
  title: string;
  content: string;
  cachedAt: number;
};

type CacheMap = Record<string, CachedLesson>;

function readCache(): CacheMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CacheMap): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
}

export function cacheLessonForOffline(lesson: { id: string; courseId: string; title: string; content: string }): void {
  const cache = readCache();
  cache[lesson.id] = { ...lesson, cachedAt: Date.now() };

  // LRU eviction at MAX_CACHED_LESSONS -- text content is a few KB each,
  // comfortably under a typical localStorage quota (5-10MB) even at the
  // cap, but an explicit bound avoids unbounded growth for a long-time user.
  const entries = Object.values(cache).sort((a, b) => b.cachedAt - a.cachedAt);
  if (entries.length > MAX_CACHED_LESSONS) {
    const keep = new Set(entries.slice(0, MAX_CACHED_LESSONS).map((e) => e.id));
    for (const id of Object.keys(cache)) {
      if (!keep.has(id)) delete cache[id];
    }
  }

  writeCache(cache);
}

export function getCachedLesson(lessonId: string): CachedLesson | null {
  const cache = readCache();
  return cache[lessonId] ?? null;
}
