import { motion } from 'framer-motion';
import { Users, Route, Lightbulb, Heart, TrendingUp, Activity } from 'lucide-react';

const METRICS = [
  {
    label: 'Visitors Today',
    value: '1,284',
    change: '+12%',
    icon: Users,
    accent: 'blue',
    bg: 'from-blue-50 to-blue-100/40',
    border: 'border-b-blue-400',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    changeColor: 'text-blue-600 bg-blue-50',
  },
  {
    label: 'Journeys Completed',
    value: '986',
    change: '+8%',
    icon: Route,
    accent: 'purple',
    bg: 'from-purple-50 to-purple-100/40',
    border: 'border-b-purple-400',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    changeColor: 'text-purple-600 bg-purple-50',
  },
  {
    label: 'Ideas Shared',
    value: '863',
    change: '+15%',
    icon: Lightbulb,
    accent: 'teal',
    bg: 'from-teal-50 to-teal-100/40',
    border: 'border-b-teal-400',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    changeColor: 'text-teal-600 bg-teal-50',
  },
  {
    label: 'Pledges Made',
    value: '1,204',
    change: '+21%',
    icon: Heart,
    accent: 'orange',
    bg: 'from-orange-50 to-orange-100/40',
    border: 'border-b-orange-400',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    changeColor: 'text-orange-500 bg-orange-50',
  },
];

const WORD_CLOUD_WORDS = [
  { word: 'Innovation', size: 'text-3xl', color: 'text-blue-500', weight: 'font-extrabold' },
  { word: 'Growth', size: 'text-2xl', color: 'text-purple-500', weight: 'font-bold' },
  { word: 'Flexibility', size: 'text-xl', color: 'text-teal-500', weight: 'font-bold' },
  { word: 'Technology', size: 'text-2xl', color: 'text-orange-500', weight: 'font-bold' },
  { word: 'Collaboration', size: 'text-lg', color: 'text-blue-400', weight: 'font-semibold' },
  { word: 'Learning', size: 'text-xl', color: 'text-purple-400', weight: 'font-semibold' },
  { word: 'Wellbeing', size: 'text-lg', color: 'text-green-500', weight: 'font-semibold' },
  { word: 'Automation', size: 'text-base', color: 'text-gray-500', weight: 'font-medium' },
  { word: 'Agility', size: 'text-xl', color: 'text-teal-400', weight: 'font-semibold' },
  { word: 'Leadership', size: 'text-base', color: 'text-blue-300', weight: 'font-medium' },
  { word: 'Community', size: 'text-lg', color: 'text-purple-300', weight: 'font-medium' },
  { word: 'Future', size: 'text-2xl', color: 'text-indigo-500', weight: 'font-bold' },
  { word: 'Upskilling', size: 'text-base', color: 'text-teal-300', weight: 'font-medium' },
  { word: 'Purpose', size: 'text-xl', color: 'text-orange-400', weight: 'font-semibold' },
  { word: 'Digital', size: 'text-lg', color: 'text-blue-400', weight: 'font-semibold' },
  { word: 'Diversity', size: 'text-base', color: 'text-pink-500', weight: 'font-medium' },
  { word: 'Resilience', size: 'text-lg', color: 'text-green-400', weight: 'font-semibold' },
  { word: 'Mentorship', size: 'text-base', color: 'text-purple-400', weight: 'font-medium' },
];

const INSIGHTS = [
  { label: 'Top theme this hour', value: 'Digital Transformation', icon: TrendingUp, color: 'text-blue-600' },
  { label: 'Most active division', value: 'Parks Development', icon: Activity, color: 'text-purple-600' },
  { label: 'Completion rate', value: '76.8%', icon: Route, color: 'text-teal-600' },
  { label: 'Avg session time', value: '4m 32s', icon: Users, color: 'text-orange-500' },
];

const PLEDGE_PHOTOS = [
  { initials: 'AL', bg: 'from-blue-400 to-blue-600' },
  { initials: 'JT', bg: 'from-purple-400 to-purple-600' },
  { initials: 'MS', bg: 'from-teal-400 to-teal-600' },
  { initials: 'RK', bg: 'from-orange-400 to-orange-600' },
  { initials: 'NW', bg: 'from-pink-400 to-pink-600' },
  { initials: 'DL', bg: 'from-indigo-400 to-indigo-600' },
  { initials: 'CY', bg: 'from-green-400 to-green-600' },
  { initials: 'BH', bg: 'from-red-400 to-red-600' },
];

export default function Pulse() {
  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-24">

        {/* Live banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between bg-gradient-to-r from-green-50 to-teal-50 border border-green-100 rounded-2xl px-5 py-3 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 live-badge text-green-700 text-sm font-semibold">
              LIVE
            </div>
            <span className="text-sm text-gray-600">Dashboard updates every 30 seconds</span>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">Last updated: just now</span>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
            Future of Work{' '}
            <span className="gradient-text">Pulse</span>
          </h1>
          <p className="text-gray-500 text-lg">
            Live insights from NParks SWP Conference 2025 participants
          </p>
        </motion.div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`bg-gradient-to-br ${m.bg} rounded-3xl p-6 border border-gray-100 border-b-4 ${m.border} shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200`}
            >
              <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center mb-4`}>
                <m.icon className={`w-5 h-5 ${m.iconColor}`} />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{m.value}</div>
              <div className="text-sm text-gray-600 font-medium mb-2">{m.label}</div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.changeColor}`}>
                {m.change} today
              </span>
            </motion.div>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Live Insights */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="bg-white rounded-3xl p-7 shadow-card border border-gray-50"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Live Insights
            </h2>
            <div className="space-y-4">
              {INSIGHTS.map(item => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <span className="text-sm text-gray-500">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Pledge photos */}
            <div className="mt-6 pt-5 border-t border-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-orange-400" />
                Recent Pledges
              </p>
              <div className="flex flex-wrap gap-2">
                {PLEDGE_PHOTOS.map((p, i) => (
                  <motion.div
                    key={p.initials}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.06, type: 'spring', stiffness: 200 }}
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.bg} flex items-center justify-center text-white text-xs font-semibold shadow-sm`}
                    aria-label={`Pledge by ${p.initials}`}
                  >
                    {p.initials}
                  </motion.div>
                ))}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium">
                  +196
                </div>
              </div>
            </div>
          </motion.div>

          {/* Word Cloud */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white rounded-3xl p-7 shadow-card border border-gray-50"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-500" />
              Idea Word Cloud
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 py-4 min-h-52">
              {WORD_CLOUD_WORDS.map((w, i) => (
                <motion.span
                  key={w.word}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.04, duration: 0.3 }}
                  className={`${w.size} ${w.color} ${w.weight} leading-tight hover:scale-110 transition-transform cursor-default`}
                  aria-hidden="true"
                >
                  {w.word}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Progress bar card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-white rounded-3xl p-7 shadow-card border border-gray-50"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Journey Stage Distribution</h2>
          <div className="space-y-5">
            {[
              { label: 'Learn', pct: 100, color: 'from-blue-400 to-blue-500', count: '1,284' },
              { label: 'Imagine', pct: 78, color: 'from-purple-400 to-purple-500', count: '1,001' },
              { label: 'Submit', pct: 67, color: 'from-teal-400 to-teal-500', count: '863' },
              { label: 'Ready', pct: 94, color: 'from-orange-400 to-orange-500', count: '1,204' },
            ].map((row, i) => (
              <div key={row.label} className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 w-16">{row.label}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${row.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-900 w-14 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
