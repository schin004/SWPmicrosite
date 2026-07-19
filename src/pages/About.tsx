import { motion } from 'framer-motion';
import { Target, RefreshCw, Zap, Workflow, Users, Cpu, Network, ArrowRight, Sparkles } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';
import Logo from '../components/Logo';

// Why Ctrl • Alt • Del — the three keyboard-inspired ideas
const KEYS = [
  {
    key: 'CTRL',
    icon: Target,
    desc: 'Decide and focus on what matters most',
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-b-blue-300',
  },
  {
    key: 'ALT',
    icon: RefreshCw,
    desc: 'Redesign how the work is done',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-b-purple-300',
  },
  {
    key: 'DEL',
    icon: Zap,
    desc: 'Free up capacity for higher-impact work',
    color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-b-teal-300',
  },
];

// How Do We Shape the Future of Work — the four focus areas
const AREAS = [
  {
    icon: Workflow,
    title: 'Work Design',
    subtitle: 'Redesign processes and ways of working',
    desc: 'Review how work is carried out today, identify opportunities to simplify and improve processes, and redesign ways of working so officers can focus on higher-value work. This includes streamlining workflows, clarifying roles, improving collaboration across teams and leveraging technology where it creates value.',
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-b-blue-300',
  },
  {
    icon: Users,
    title: 'Workforce',
    subtitle: 'Build the workforce of the future',
    desc: 'Identify the roles, skills and capabilities NParks will need while supporting officers to learn, grow and remain future-ready.',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-b-purple-300',
  },
  {
    icon: Cpu,
    title: 'Technology & Data',
    subtitle: 'Enable smarter ways of working',
    desc: 'Leverage AI, automation, digital tools and data to improve decision-making and support redesigned workflows.',
    color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-b-teal-300',
  },
  {
    icon: Network,
    title: 'Operating Model',
    subtitle: 'Bring people, processes and resources together',
    desc: 'Review how teams are organised, how work is delivered, and how functions such as HR, IT, Finance, Procurement, Communications and Strategic Planning work together to enable transformation.',
    color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-b-orange-300',
  },
];

const ONE_MINUTE = [
  'Redesign work before redesigning jobs.',
  'Bring people, processes and technology together.',
  'Build future-ready skills and careers.',
  'Solve real operational challenges with the business.',
  'Shape the future of NParks together.',
];

export default function About() {
  const { setCurrentPage, setJourneyActive, setCurrentStep } = useJourney();

  const exploreIdeas = () => {
    setCurrentPage('journey');
    setJourneyActive(true);
    setCurrentStep(2); // → Explore
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-24">

        {/* 1 — Ctrl • Alt • Del: Shaping the Future of Work Together */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          {/* Logo showcase — crisp SVG keycap mark (lightweight, scales perfectly) */}
          <div className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-br from-brand-navy to-brand-ink shadow-xl ring-1 ring-brand-navy/10 mb-8 px-10 py-10 w-full max-w-xl">
            <Logo variant="full" className="h-16 md:h-20 w-auto" title="Ctrl Alt Del" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-5 tracking-tight">
            <span className="gradient-text">Ctrl • Alt • Del</span>
            <span className="block text-gray-900 text-3xl md:text-4xl mt-2">Shaping the Future of Work Together</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-card border border-gray-50 mb-8"
        >
          <div className="max-w-3xl mx-auto space-y-4 text-gray-600 leading-relaxed text-lg">
            <p>
              The way we work is changing. Technology is advancing rapidly, our operating environment is becoming more complex, expectations continue to evolve, and manpower will remain tight.
            </p>
            <p>
              To continue delivering our mission, we need to work differently—not simply work harder.
            </p>
            <p>
              Strategic Workforce Planning (SWP) is how NParks is preparing for this future—not by simply adding more people, but by redesigning work, strengthening capabilities and making better use of technology so we can continue delivering our mission.
            </p>
            <p>
              Through SWP, officers across NParks are working together to rethink how work is done, identify better ways of working, and build a future-ready workforce where everyone can contribute at their best.
            </p>
          </div>

          {/* Callout */}
          <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100/60 max-w-3xl mx-auto flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-gray-700 leading-relaxed">
              <span className="font-bold text-gray-900">Your ideas matter.</span> This Future of Work Hub lets you explore ideas, share your perspectives, and help shape how we work at NParks.
            </p>
          </div>
        </motion.div>

        {/* 2 — Why Ctrl • Alt • Del? */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-card border border-gray-50 mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">Why Ctrl • Alt • Del?</h2>
          <p className="text-gray-500 text-center max-w-2xl mx-auto mb-8 leading-relaxed">
            The familiar keyboard shortcut inspired our Staff Conference theme—but instead of restarting a computer, we're using it to rethink how work gets done at NParks.
          </p>

          <div className="grid sm:grid-cols-3 gap-5 mb-8">
            {KEYS.map((k, i) => (
              <motion.div
                key={k.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className={`bg-white rounded-3xl p-7 text-center shadow-card border border-gray-100 border-b-4 ${k.border} hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200`}
              >
                <div className={`w-12 h-12 rounded-2xl ${k.bg} flex items-center justify-center mx-auto mb-4`}>
                  <k.icon className={`w-6 h-6 ${k.color}`} />
                </div>
                <div className={`text-2xl font-extrabold tracking-wide mb-2 ${k.color}`}>{k.key}</div>
                <p className="text-gray-600 text-sm leading-relaxed">{k.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100/60 text-center max-w-2xl mx-auto">
            <p className="font-semibold text-gray-900 mb-1">Every officer has a role in shaping the future of work.</p>
            <p className="text-gray-600 text-sm leading-relaxed">
              Visit our Staff Conference booth or submit your ideas through this Future of Work Hub. Every idea helps shape the future of work at NParks.
            </p>
          </div>
        </motion.div>

        {/* 3 — SWP in One Minute */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-card border border-gray-50 mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">SWP in One Minute</h2>
          <ul className="grid sm:grid-cols-2 gap-4">
            {ONE_MINUTE.map((item, i) => (
              <li key={item} className="flex items-start gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold bg-gradient-to-br ${['from-blue-400 to-blue-600', 'from-purple-400 to-purple-600', 'from-teal-400 to-teal-600', 'from-orange-400 to-orange-600', 'from-blue-400 to-purple-600'][i]}`}>
                  {i + 1}
                </span>
                <span className="text-gray-700 leading-relaxed pt-0.5">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* 4 — How Do We Shape the Future of Work? */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">How Do We Shape the Future of Work?</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {AREAS.map((a, i) => (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className={`bg-white rounded-3xl p-7 shadow-card border border-gray-100 border-b-4 ${a.border} hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200`}
              >
                <div className={`w-11 h-11 rounded-xl ${a.bg} flex items-center justify-center mb-4`}>
                  <a.icon className={`w-6 h-6 ${a.color}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{a.title}</h3>
                <p className={`text-sm font-semibold mb-3 ${a.color}`}>{a.subtitle}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 5 — CTA to Explore / Share */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl p-8 md:p-10 text-center shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Every officer has a role in shaping the future of work.</h2>
          <p className="text-white/80 text-lg mb-7 max-w-xl mx-auto">
            Explore the ideas developed by our workgroups, share your own ideas, and help shape how we work at NParks.
          </p>
          <button
            onClick={exploreIdeas}
            className="group inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
          >
            Explore the Ideas
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
