// Avatar identity system (founder request, 2026-07-23; mascot requirement
// added 2026-07-23): a student picks a "totem" -- the real, well-known
// nickname of an African national football team -- as their display
// identity, shown as a mascot badge (emoji glyph + brand color), not a
// plain-text label. No illustrated character art: no image-generation
// capability in this environment, and no real team crests/logos are used
// (those are the actual trademarked assets) -- the emoji + the public
// nickname are common-parlance, same register as calling a team "the
// Lakers." Cameroon's own team is listed first since S@Learn is a Douala
// product.
export type Totem = {
  name: string;
  country: string;
  emoji: string;
  bgClass: string;
  textClass: string;
};

export const TOTEMS: Totem[] = [
  { name: 'Indomitable Lions', country: 'Cameroon', emoji: '🦁', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  { name: 'Black Stars', country: 'Ghana', emoji: '⭐', bgClass: 'bg-yellow-100', textClass: 'text-yellow-800' },
  { name: 'Super Eagles', country: 'Nigeria', emoji: '🦅', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' },
  { name: 'Teranga Lions', country: 'Senegal', emoji: '🦁', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  { name: 'Elephants', country: "Côte d'Ivoire", emoji: '🐘', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { name: 'Atlas Lions', country: 'Morocco', emoji: '🦁', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  { name: 'Pharaohs', country: 'Egypt', emoji: '👑', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  { name: 'Chipolopolo', country: 'Zambia', emoji: '⚡', bgClass: 'bg-sky-100', textClass: 'text-sky-700' },
  { name: 'Warriors', country: 'Zimbabwe', emoji: '🛡️', bgClass: 'bg-rose-100', textClass: 'text-rose-700' },
  { name: 'Harambee Stars', country: 'Kenya', emoji: '🌟', bgClass: 'bg-teal-100', textClass: 'text-teal-700' },
];

export const TOTEM_NAMES = TOTEMS.map((t) => t.name);

export function totemByName(name: string | null | undefined): Totem | null {
  if (!name) return null;
  return TOTEMS.find((t) => t.name === name) ?? null;
}
