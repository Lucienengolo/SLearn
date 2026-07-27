import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createClassworkPost,
  deleteClassworkPost,
  fetchClassworkPosts,
  fetchMySubmission,
  fetchSubmissionsForPost,
  gradeSubmission,
  submitClasswork,
} from '../lib/classwork';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.insert = vi.fn(() => Promise.resolve(result));
  builder.upsert = vi.fn(() => Promise.resolve(result));
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('lib/classwork', () => {
  // clearAllMocks, not restoreAllMocks -- '../lib/supabase' is auto-mocked
  // via vi.mock() above, and restoreAllMocks doesn't reset call history on
  // those, only on vi.spyOn-created mocks.
  beforeEach(() => vi.clearAllMocks());

  describe('createClassworkPost', () => {
    it('rejects an empty title without hitting the network', async () => {
      await expect(
        createClassworkPost({ courseId: 'c1', instructorId: 'i1', type: 'announcement', title: '   ' })
      ).rejects.toThrow(/enter a title/i);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('drops maxPoints for non-assignment posts', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

      await createClassworkPost({
        courseId: 'c1',
        instructorId: 'i1',
        type: 'material',
        title: 'Slides',
        maxPoints: 100,
      });

      expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ max_points: null }));
    });

    it('keeps maxPoints for assignment posts', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

      await createClassworkPost({
        courseId: 'c1',
        instructorId: 'i1',
        type: 'assignment',
        title: 'Essay',
        maxPoints: 100,
      });

      expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ max_points: 100, type: 'assignment' }));
    });

    it('throws when the insert errors', async () => {
      const builder = mockBuilder({ data: null, error: new Error('boom') });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
      await expect(
        createClassworkPost({ courseId: 'c1', instructorId: 'i1', type: 'announcement', title: 'Hi' })
      ).rejects.toThrow('boom');
    });
  });

  describe('submitClasswork', () => {
    it('rejects empty content without hitting the network', async () => {
      await expect(submitClasswork('post-1', 'student-1', '   ')).rejects.toThrow(/enter your submission/i);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('upserts on post_id,student_id', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

      await submitClasswork('post-1', 'student-1', 'my essay');

      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ post_id: 'post-1', student_id: 'student-1', content: 'my essay' }),
        { onConflict: 'post_id,student_id' }
      );
    });
  });

  describe('gradeSubmission', () => {
    it('sets grade, feedback, and graded_at', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

      await gradeSubmission('sub-1', 92, 'Great work');

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ grade: 92, feedback: 'Great work' })
      );
      expect(builder.eq).toHaveBeenCalledWith('id', 'sub-1');
    });
  });

  describe('read helpers', () => {
    it('fetchClassworkPosts returns [] without querying when there are no course ids', async () => {
      const result = await fetchClassworkPosts([]);
      expect(result).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('fetchClassworkPosts maps rows through', async () => {
      const builder = mockBuilder({ data: [{ id: 'p1', title: 'Essay' }], error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
      const result = await fetchClassworkPosts(['c1']);
      expect(result).toEqual([{ id: 'p1', title: 'Essay' }]);
    });

    it('fetchMySubmission returns null when nothing found', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
      expect(await fetchMySubmission('p1', 's1')).toBeNull();
    });

    it('fetchSubmissionsForPost throws on error', async () => {
      const builder = mockBuilder({ data: null, error: new Error('nope') });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
      await expect(fetchSubmissionsForPost('p1')).rejects.toThrow('nope');
    });

    it('deleteClassworkPost calls delete().eq(id)', async () => {
      const builder = mockBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
      await deleteClassworkPost('p1');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
    });
  });
});
