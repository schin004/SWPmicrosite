import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Target, Compass, Sprout, MessagesSquare, RotateCcw, Lightbulb } from 'lucide-react';
import FlipCard from '../components/FlipCard';
import { useJourney } from '../context/JourneyContext';

const CARDS = [
  {
    icon: Target,
    category: 'Focus',
    title: 'Spend More Time on What Matters',
    summary: 'Identify what matters most, review and simplify work, and use better processes, automation and AI to free up time for meaningful, impactful work.',
    detail: 'Identify what matters most, review and simplify work, and use better processes, automation and AI to free up time for meaningful, impactful work.',
    accent: 'teal' as const,
    bg: 'from-teal-50 to-teal-100/50',
    border: 'border-b-teal-300',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    backBg: 'from-teal-500 to-teal-700',
  },
  {
    icon: Compass,
    category: 'Readiness',
    title: 'Stay Ahead of Change',
    summary: 'Build confidence to adapt as work, technology and roles evolve — by learning continuously and using tools, data and AI to work better.',
    detail: 'Build confidence to adapt as work, technology and roles evolve — by learning continuously and using tools, data and AI to work better.',
    accent: 'blue' as const,
    bg: 'from-blue-50 to-blue-100/50',
    border: 'border-b-blue-300',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    backBg: 'from-blue-500 to-blue-700',
  },
  {
    icon: Sprout,
    category: 'Growth',
    title: 'Grow with the Future',
    summary: 'See future career pathways more clearly, build critical capabilities, and access learning that helps you grow with Acme evolving needs.',
    detail: 'See future career pathways more clearly, build critical capabilities, and access learning that helps you grow with Acme evolving needs.',
    accent: 'green' as const,
    bg: 'from-green-50 to-green-100/50',
    border: 'border-b-green-300',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    backBg: 'from-green-500 to-green-700',
  },
  {
    icon: MessagesSquare,
    category: 'Co-creation',
    title: 'Help Shape the Future',
    summary: 'Your ideas matter. SWP is co-created with officers to develop practical solutions that improve the way we work.',
    detail: 'Your ideas matter. SWP is co-created with officers to develop practical solutions that improve the way we work.',
    accent: 'amber' as const,
    bg: 'from-amber-50 to-amber-100/50',
    border: 'border-b-amber-300',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    backBg: 'from-amber-400 to-amber-600',
  },
];

export default function Learn() {
  const { completeStep, setCurrentStep } = useJourney();

  // Mark step 1 completed immediately on mount
  useEffect(() => {
    completeStep(1);
  }, []);

  const goNext = () => {
    setCurrentStep(2); // → Explore
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-blue-100">
            <Lightbulb className="w-4 h-4" />
            Step 1 of 4
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            What's In It{' '}
            <span className="gradient-text">For Me?</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            Tap any card to explore how Strategic Workforce Planning shapes your future at Acme.
          </p>
          <p className="text-sm text-gray-400 mt-2 flex items-center justify-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Tap to flip • Tap again to flip back
          </p>
        </motion.div>

        {/* 2×2 card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <FlipCard
                minHeight="300px"
                front={
                  <div
                    className={`h-full flex flex-col p-7 bg-gradient-to-br ${card.bg} rounded-3xl border border-gray-100 border-b-4 ${card.border} shadow-card hover:shadow-card-hover transition-shadow`}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-5`}>
                      <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${card.iconColor} mb-2`}>
                      {card.category}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed flex-1">{card.summary}</p>
                    <div className={`mt-5 text-xs font-medium ${card.iconColor} flex items-center gap-1.5`}>
                      <RotateCcw className="w-3 h-3" />
                      Tap to explore
                    </div>
                  </div>
                }
                back={
                  <div className={`h-full flex flex-col p-7 bg-gradient-to-br ${card.backBg} rounded-3xl shadow-card`}>
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
                      <card.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                      {card.category}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-4">{card.title}</h3>
                    <p className="text-white/90 text-sm leading-relaxed flex-1">{card.detail}</p>
                    <div className="mt-5 text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <RotateCcw className="w-3 h-3" />
                      Tap to flip back
                    </div>
                  </div>
                }
              />
            </motion.div>
          ))}
        </div>

        {/* Next step */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={goNext}
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Continue to Explore
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
