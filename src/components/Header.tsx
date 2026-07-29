import { Leaf, FoliageBand } from './Botanical';

// The illustrated, park-noticeboard-style banner used at the top of the public
// portal and the admin dashboard.
export function Header({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-forest text-cream">
      {/* faint large leaves in the banner */}
      <Leaf className="absolute -right-10 -top-10 h-56 w-56 rotate-12 text-white/5" />
      <Leaf className="absolute -left-12 top-6 h-40 w-40 -rotate-45 text-white/5" />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
        <div>
          <div className="flex items-center gap-2 text-sage">
            <Leaf className="h-5 w-5 text-sage" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{eyebrow}</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm text-sage-light/90 sm:text-base">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <FoliageBand className="block h-8 w-full text-cream sm:h-10" />
    </header>
  );
}
