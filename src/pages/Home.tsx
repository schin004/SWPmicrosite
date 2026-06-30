import { motion } from 'framer-motion';
import { ArrowRight, BarChart2, Sparkles, Users, Zap } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' as const },
});

const STATS = [
  { icon: Users, label: 'Participants', value: '2,400+', color: 'text-blue-500', bg: 'bg-blue-50' },
  { icon: Sparkles, label: 'Ideas Shared', value: '860+', color: 'text-purple-500', bg: 'bg-purple-50' },
  { icon: Zap, label: 'Pledges Made', value: '1,200+', color: 'text-teal-500', bg: 'bg-teal-50' },
  { icon: BarChart2, label: 'Journeys Done', value: '980+', color: 'text-orange-500', bg: 'bg-orange-50' },
];

export default function Home() {
  const { setCurrentPage, setJourneyActive, setCurrentStep } = useJourney();

  const startJourney = () => {
    setCurrentPage('journey');
    setJourneyActive(true);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewPulse = () => {
    setCurrentPage('pulse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-20 text-center">
        {/* Welcome pill */}
        <motion.div {...fadeUp(0.1)} className="inline-flex items-center gap-2 mb-8">
          <span className="inline-flex items-center gap-2 bg-white border border-blue-100 text-blue-600 text-sm font-medium px-4 py-2 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            NParks Strategic Workforce Planning Conference 2025
          </span>
        </motion.div>

        {/* Main heading */}
        <motion.h1 {...fadeUp(0.2)} className="text-6xl md:text-7xl lg:text-8xl font-extrabold leading-none tracking-tight mb-6">
          <span className="block text-gray-900">Ctrl.</span>
          <span className="block gradient-text">Alt.</span>
          <span className="block text-gray-900">Delete.</span>
        </motion.h1>

        <motion.p {...fadeUp(0.35)} className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Reimagine the future of work at NParks.{' '}
          <span className="text-gray-700 font-medium">Your voice shapes what comes next.</span>
        </motion.p>

        {/* Progress hint */}
        <motion.div {...fadeUp(0.45)} className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${s === 1 ? 'w-8 bg-gradient-to-r from-blue-500 to-purple-500' : 'w-4 bg-gray-200'}`}
            />
          ))}
          <span className="ml-2 text-sm text-gray-400">4-step journey</span>
        </motion.div>

        {/* CTA buttons */}
        <motion.div {...fadeUp(0.5)} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={startJourney}
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Start My Journey"
          >
            Start My Journey
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={viewPulse}
            className="flex items-center gap-2 bg-white text-gray-700 font-semibold px-8 py-4 rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="View Live Pulse"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            View Live Pulse
          </button>
        </motion.div>
      </section>

      {/* Stats row */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: 'easeOut' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-3xl p-6 shadow-card border border-gray-50 flex flex-col items-center gap-3 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200"
            >
              <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Journey overview */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-card border border-gray-50"
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Your Journey Awaits</h2>
            <p className="text-gray-500 text-lg">Four simple steps to shape the future of NParks</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { step: 1, label: 'Learn', desc: 'Discover how SWP benefits you and your team', color: 'from-blue-400 to-blue-600', light: 'bg-blue-50', text: 'text-blue-600' },
              { step: 2, label: 'Imagine', desc: 'Share your ideas about the future of work', color: 'from-purple-400 to-purple-600', light: 'bg-purple-50', text: 'text-purple-600' },
              { step: 3, label: 'Submit', desc: 'Send your idea and make your mark', color: 'from-teal-400 to-teal-600', light: 'bg-teal-50', text: 'text-teal-600' },
              { step: 4, label: 'Ready', desc: 'Make your pledge for the future', color: 'from-orange-400 to-orange-600', light: 'bg-orange-50', text: 'text-orange-600' },
            ].map(item => (
              <div key={item.step} className="flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                  {item.step}
                </div>
                <div className="font-semibold text-gray-900">{item.label}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={startJourney}
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-3.5 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Begin Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
