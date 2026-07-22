import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { useJourney, type Page } from '../context/JourneyContext';

const NAV_ITEMS: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Future of Work Journey', page: 'journey' },
  { label: 'Future of Work Pulse', page: 'pulse' },
  { label: 'About SWP', page: 'about' },
];

export default function Navigation() {
  const { currentPage, setCurrentPage, setJourneyActive, setCurrentStep, setShowCongrats } = useJourney();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (page: Page) => {
    setShowCongrats(false);
    setCurrentPage(page);
    if (page === 'journey') {
      setJourneyActive(true);
      setCurrentStep(1);
    } else {
      setJourneyActive(false);
    }
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-nav"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy rounded-lg py-1"
            aria-label="Ctrl Alt Del — Acme Future of Work, Home"
          >
            <Logo variant="mark" className="h-7 w-auto" title="Ctrl Alt Del" />
            <span className="hidden sm:block w-px h-7 bg-gray-200" aria-hidden="true" />
            <div className="hidden sm:flex flex-col leading-none text-left">
              <span className="text-sm font-bold text-gray-900">Acme</span>
              <span className="text-[10px] text-gray-500 font-medium tracking-wide">Future of Work</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const isActive = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => navigate(item.page)}
                  className={`
                    relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                    ${isActive
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1 shadow-lg">
          {NAV_ITEMS.map(item => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`
                  w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
