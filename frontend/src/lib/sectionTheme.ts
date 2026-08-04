// Rotating accent themes for board sections. Class strings are written out in
// full so Tailwind's JIT keeps them.
export interface SectionTheme {
  bar: string;      // gradient accent strip on the column header
  badge: string;    // count pill
  ring: string;     // drop-target ring color
  dropBg: string;   // drop-target background tint
  glowText: string; // header title hover color
}

export const SECTION_THEMES: SectionTheme[] = [
  { bar: "from-indigo-400 to-violet-500", badge: "bg-indigo-100 text-indigo-700", ring: "ring-indigo-300", dropBg: "bg-indigo-50/80", glowText: "hover:text-indigo-600" },
  { bar: "from-sky-400 to-cyan-500",      badge: "bg-sky-100 text-sky-700",       ring: "ring-sky-300",    dropBg: "bg-sky-50/80",    glowText: "hover:text-sky-600" },
  { bar: "from-emerald-400 to-teal-500",  badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-300", dropBg: "bg-emerald-50/80", glowText: "hover:text-emerald-600" },
  { bar: "from-amber-400 to-orange-500",  badge: "bg-amber-100 text-amber-700",   ring: "ring-amber-300",  dropBg: "bg-amber-50/80",  glowText: "hover:text-amber-600" },
  { bar: "from-rose-400 to-pink-500",     badge: "bg-rose-100 text-rose-700",     ring: "ring-rose-300",   dropBg: "bg-rose-50/80",   glowText: "hover:text-rose-600" },
  { bar: "from-fuchsia-400 to-purple-500", badge: "bg-fuchsia-100 text-fuchsia-700", ring: "ring-fuchsia-300", dropBg: "bg-fuchsia-50/80", glowText: "hover:text-fuchsia-600" },
  { bar: "from-slate-400 to-slate-500",   badge: "bg-slate-200 text-slate-600",   ring: "ring-slate-300",  dropBg: "bg-slate-100/80", glowText: "hover:text-slate-700" },
];

export function themeFor(index: number): SectionTheme {
  return SECTION_THEMES[index % SECTION_THEMES.length];
}
