import Logo from './Logo';
import { useJourney, type Page } from '../context/JourneyContext';

const LINKS: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Future of Work Journey', page: 'journey' },
  { label: 'Future of Work Pulse', page: 'pulse' },
  { label: 'About SWP', page: 'about' },
];

export default function Footer() {
  const { setCurrentPage, setJourneyActive, setCurrentStep, setShowCongrats } = useJourney();

  const go = (page: Page) => {
    setShowCongrats(false);
    setCurrentPage(page);
    if (page === 'journey') { setJourneyActive(true); setCurrentStep(1); }
    else setJourneyActive(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative z-10 mt-20 bg-brand-navy text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          {/* Brand */}
          <div className="max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <Logo variant="mark" className="h-8 w-auto" title="Ctrl Alt Del" />
              <div className="leading-none">
                <div className="text-base font-bold">Acme</div>
                <div className="text-xs text-white/60 tracking-wide">Future of Work</div>
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              <span className="font-semibold text-white">Ctrl • Alt • Del</span> — rethinking how work
              gets done at Acme. Focus on what matters, redesign the way we work, and free up
              capacity for higher-impact work.
            </p>
          </div>

          {/* Quick links */}
          <nav aria-label="Footer navigation">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">Explore</p>
            <ul className="space-y-2.5">
              {LINKS.map(l => (
                <li key={l.page}>
                  <button
                    onClick={() => go(l.page)}
                    className="text-sm text-white/75 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} National Parks Board. Shaping the future of work together.
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-ctrl" />
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-alt" />
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-del" />
          </div>
        </div>
      </div>
    </footer>
  );
}
