-- Avatar identity ("totem") system (founder request, 2026-07-23). Keep this
-- CHECK list in sync with lib/totems.ts's TOTEMS array -- both must match
-- exactly or a valid client-side selection could be rejected server-side.
alter table profiles
  add column totem text check (
    totem is null or totem in (
      'Indomitable Lions',
      'Black Stars',
      'Super Eagles',
      'Teranga Lions',
      'Elephants',
      'Atlas Lions',
      'Pharaohs',
      'Chipolopolo',
      'Warriors',
      'Harambee Stars'
    )
  );
