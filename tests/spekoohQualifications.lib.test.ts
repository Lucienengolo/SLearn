import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { fetchMyQualifications, fetchSpekoohCategories, saveSpekoohQualifications } from '../lib/spekoohMarkingRequests';

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

describe('fetchSpekoohCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks the edge function to list Spekooh\'s live categories', async () => {
    const categories = [{ key: 'secondary', title: 'Secondary' }];
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { categories }, error: null });

    expect(await fetchSpekoohCategories()).toEqual(categories);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('spekooh-qualifications', { body: { action: 'list_categories' } });
  });

  it('throws when the edge function errors', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error('down') });
    await expect(fetchSpekoohCategories()).rejects.toBeTruthy();
  });
});

describe('fetchMyQualifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the instructor\'s own row', async () => {
    const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { qualified_categories: ['secondary'] }, error: null }) });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    expect(await fetchMyQualifications('instructor-1')).toEqual(['secondary']);
    expect(supabase.from).toHaveBeenCalledWith('spekooh_instructor_qualifications');
    expect(eq).toHaveBeenCalledWith('instructor_id', 'instructor-1');
  });

  it('returns an empty list for an instructor with no row yet', async () => {
    const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) });
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) } as never);

    expect(await fetchMyQualifications('instructor-1')).toEqual([]);
  });
});

describe('saveSpekoohQualifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the chosen categories to the edge function and returns its result', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true }, error: null });

    const result = await saveSpekoohQualifications(['secondary', 'university']);

    expect(result).toEqual({ ok: true });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('spekooh-qualifications', {
      body: { action: 'save', qualified_categories: ['secondary', 'university'] },
    });
  });
});
