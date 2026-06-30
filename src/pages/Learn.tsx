import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, Users, Compass, Lightbulb, RotateCcw } from 'lucide-react';
import FlipCard from '../components/FlipCard';
import { useJourney } from '../context/JourneyContext';

const CARDS = [
  {
    icon: TrendingUp,
    category: 'Growth',
    title: 'Career Development',
    summary: 'SWP creates clear career pathways tailored to your strengths and aspirations.',
    detail: 'Through Strategic Workforce Planning, NParks maps out individual career trajectories. You\'ll gain access to structured upskilling programmes, mentorship opportunities, and cross-functional projects that prepare you for roles of the future — all personalised to your unique profile.',
    accent: 'blue' as const,
    bg: 'from-blue-50 to-blue-100/50',
    border: 'border-b-blue-300',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    backBg: 'from-blue-500 to-blue-700',
  },
  {
    icon: Users,
    category: 'Collaboration',
    title: 'Team Excellence',
    summary: 'Build stronger teams through better understanding of collective capabilities.',
    detail: 'SWP enables leaders to visualise team competencies in real-time, identify gaps, and proactively build skills before they\'re urgently needed. This means better collaboration, more agile project delivery, and teams that thrive under any challenge.',
    accent: 'purple' as const,
    bg: 'from-purple-50 to-purple-100/50',
    border: 'border-b-purple-300',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    backBg: 'from-purple-500 to-purple-700',
  },
  {
    icon: Compass,
    category: 'Direction',
    title: 'Organisational Clarity',
    summary: 'Align individual roles with NParks\' long-term strategic direction.',
    detail: 'SWP ensures every role at NParks is purposefully connected to our mission. You\'ll have clarity on how your work contributes to NParks\' vision, making your day-to-day more meaningful and helping leadership make informed resourcing decisions.',
    accent: 'teal' as const,
    bg: 'from-teal-50 to-teal-100/50',
    border: 'border-b-teal-300',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    backBg: 'from-teal-500 to-teal-700',
  },
  {
    icon: Lightbulb,
    category: 'Innovation',
    title: 'Future Readiness',
    summary: 'Stay ahead of industry shifts with proactive workforce intelligence.',
    detail: 'SWP uses data and foresight tools to anticipate how technology, policy, and global trends will reshape our workforce needs. Being part of this means you\'re always prepared — not just reacting to change, but leading it with confidence.',
    accent: 'orange' as const,
    bg: 'from-orange-50 to-orange-100/50',
    border: 'border-b-orange-300',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    backBg: 'from-orange-400 to-orange-600',
  },
];

export default function Learn() {
  const { completeStep, setCurrentStep } = useJourney();

  // Mark step 1 completed immediately on mount
  useEffect(() => {
    completeStep(1);
  }, []);

  const goNext = () => {
    setCurrentStep(2);
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
            How Will SWP{' '}
            <span className="gradient-text">Benefit Me?</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            Tap any card to explore how Strategic Workforce Planning shapes your future at NParks.
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
            Continue to Imagine
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
