import { motion } from 'framer-motion';
import { Leaf, Target, Users, BarChart2, Compass, ArrowRight } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';

const PILLARS = [
  {
    icon: Target,
    title: 'Strategic Direction',
    desc: 'Aligning workforce capabilities with NParks\' long-term mission to create a City in Nature.',
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-b-blue-300',
  },
  {
    icon: Users,
    title: 'People First',
    desc: 'Placing every officer at the centre of workforce planning, recognising that our people are our greatest asset.',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-b-purple-300',
  },
  {
    icon: BarChart2,
    title: 'Data-Driven Insights',
    desc: 'Using robust analytics to anticipate future workforce needs and make informed, evidence-based decisions.',
    color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-b-teal-300',
  },
  {
    icon: Compass,
    title: 'Future Readiness',
    desc: 'Building organisational agility to navigate technological disruption and evolving job landscapes.',
    color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-b-orange-300',
  },
];

export default function About() {
  const { setCurrentPage, setJourneyActive, setCurrentStep } = useJourney();

  const startJourney = () => {
    setCurrentPage('journey');
    setJourneyActive(true);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            About{' '}
            <span className="gradient-text">SWP</span>
          </h1>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto leading-relaxed">
            Strategic Workforce Planning (SWP) is NParks' forward-looking approach to ensuring we have the right people, with the right skills, in the right roles — now and into the future.
          </p>
        </motion.div>

        {/* What is SWP */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-card border border-gray-50 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-5">What is Strategic Workforce Planning?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-gray-600 leading-relaxed mb-4">
                SWP is a systematic process that connects NParks' organisational strategy to its people strategy. It helps us understand the gap between our current workforce capabilities and what we will need in the future.
              </p>
              <p className="text-gray-600 leading-relaxed">
                By engaging every officer in this process, we ensure that our workforce planning is grounded in real insights, aspirations, and challenges — making NParks more agile, resilient, and future-ready.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100/50">
              <p className="text-sm font-semibold text-gray-700 mb-4">SWP at a Glance</p>
              <ul className="space-y-3">
                {[
                  'Launched at SWP Conference 2025',
                  'Covers all NParks divisions',
                  '3-year horizon planning',
                  'Officer-led, leadership-supported',
                  'Data-informed decisions',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Four Pillars</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`bg-white rounded-3xl p-6 shadow-card border border-gray-100 border-b-4 ${p.border} hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200`}
              >
                <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center mb-4`}>
                  <p.icon className={`w-5 h-5 ${p.color}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl p-8 md:p-10 text-center shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to Shape the Future?</h2>
          <p className="text-white/80 text-lg mb-7 max-w-xl mx-auto">
            Join your colleagues in envisioning what work looks like at NParks in the years ahead.
          </p>
          <button
            onClick={startJourney}
            className="group inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
          >
            Start My Journey
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
