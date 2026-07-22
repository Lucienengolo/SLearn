import { useCallback, useEffect, useState } from 'react';
import { fetchMyTutorRequests, TutorRequestListItem } from '../../lib/tutorRequests';

type MyRequestsProps = {
  parentId: string;
  onSelectRequest: (requestId: string) => void;
  onNewRequest: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  searching: 'Recherche en cours',
  matched: 'Tuteur trouvé',
  cancelled: 'Annulée',
};

// Design Review D2: one row per child_identifier so a parent with multiple
// children can tell requests apart at a glance (fetchMyTutorRequests already
// sorts by child_identifier). D3: warm/actionable empty state, not a bare
// "no requests" message.
export default function MyRequests({ parentId, onSelectRequest, onNewRequest }: MyRequestsProps) {
  const [requests, setRequests] = useState<TutorRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await fetchMyTutorRequests(parentId));
    } catch {
      setError('Impossible de charger vos demandes.');
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-warm-gray">Chargement…</p>;
  if (error) return <p className="text-sm text-oxblood font-medium">{error}</p>;

  return (
    <div className="max-w-[700px] font-general-sans text-ink">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-fraunces text-[24px] font-medium">Mes demandes</h1>
        <button
          onClick={onNewRequest}
          className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
        >
          Nouvelle demande
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="border border-dashed border-ink-border rounded-lg p-8 text-center">
          <p className="text-sm font-semibold mb-1">Vous n&apos;avez pas encore fait de demande.</p>
          <p className="text-[13px] text-warm-gray mb-4">Trouvez un tuteur pour votre enfant en quelques minutes.</p>
          <button
            onClick={onNewRequest}
            className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
          >
            Faire ma première demande
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRequest(r.id)}
              className="text-left border border-ink-border rounded-lg p-4 hover:border-warm-gray transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{r.child_identifier ?? 'Enfant non précisé'}</span>
                <span className="text-[12px] font-plex-mono text-warm-gray">{STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
              <p className="text-[13px] text-warm-gray">
                {r.categories?.name ?? 'Matière'} · {r.grade} · {r.neighborhood}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
