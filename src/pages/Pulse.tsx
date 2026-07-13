import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Route, Lightbulb, Heart, TrendingUp, Activity } from 'lucide-react';
import { fetchPulseData } from '../lib/db';
import type { PulseData } from '../lib/db';

const WORD_COLORS = [
  'text-blue-500', 'text-purple-500', 'text-teal-500', 'text-orange-500',
  'text-indigo-500', 'text-pink-500', 'text-green-500', 'text-red-400',
  'text-blue-400', 'text-purple-400', 'text-teal-400', 'text-orange-400',
];
const WORD_SIZES = ['text-3xl font-extrabold', 'text-2xl font-bold', 'text-xl font-bold', 'text-lg font-semibold', 'text-base font-medium'];

function sizeClass(count: number, max: number) {
  const ratio = max > 1 ? count / max : 1;
  if (ratio > 0.8) return WORD_SIZES[0];
  if (ratio > 0.6) return WORD_SIZES[1];
  if (ratio > 0.4) return WORD_SIZES[2];
  if (ratio > 0.2) return WORD_SIZES[3];
  return WORD_SIZES[4];
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function Pulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    let alive = true;
    async function load() {
      const d = await fetchPulseData();
      if (alive && d) { setData(d); setLastUpdated(new Date()); }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const maxWordCount = data?.topWords[0]?.count ?? 1;

  const METRICS = [
    {
      label: 'Visitors Today',
      value: data ? fmt(data.visitorsToday) : '—',
      icon: Users,
      bg: 'from-blue-50 to-blue-100/40', border: 'border-b-blue-400',
      iconBg: 'bg-blue-100', iconColor: 'text-blue-600', changeColor: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Journeys Completed',
      value: data ? fmt(data.journeysCompleted) : '—',
      icon: Route,
      bg: 'from-purple-50 to-purple-100/40', border: 'border-b-purple-400',
      iconBg: 'bg-purple-100', iconColor: 'text-purple-600', changeColor: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Ideas Shared',
      value: data ? fmt(data.ideasCount) : '—',
      icon: Lightbulb,
      bg: 'from-teal-50 to-teal-100/40', border: 'border-b-teal-400',
      iconBg: 'bg-teal-100', iconColor: 'text-teal-600', changeColor: 'text-teal-600 bg-teal-50',
    },
    {
      label: 'Pledges Made',
      value: data ? fmt(data.pledgesCount) : '—',
      icon: Heart,
      bg: 'from-orange-50 to-orange-100/40', border: 'border-b-orange-400',
      iconBg: 'bg-orange-100', iconColor: 'text-orange-500', changeColor: 'text-orange-500 bg-orange-50',
    },
  ];

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
          <span className="text-xs text-gray-400 tabular-nums">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
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
            Live insights from NParks Staff Conference 2026 participants
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
              <div className="text-sm text-gray-600 font-medium">{m.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Ideas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="bg-white rounded-3xl p-7 shadow-card border border-gray-50"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Recent Ideas
            </h2>
            {data?.recentIdeas.length ? (
              <div className="space-y-3">
                {data.recentIdeas.map((idea, i) => (
                  <div key={i} className="py-3 border-b border-gray-50 last:border-0">
                    <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">"{idea.idea_text}"</p>
                    {idea.category && (
                      <span className="mt-1.5 inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {idea.category}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No ideas submitted yet — be the first!</p>
            )}

            {/* Reaction breakdown */}
            {data?.reactionBreakdown.length ? (
              <div className="mt-6 pt-5 border-t border-gray-50">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-orange-400" />
                  Reactions to Ideas
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.reactionBreakdown.map(r => (
                    <span key={r.reaction} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 text-sm">
                      <span>{r.emoji}</span>
                      <span className="font-semibold text-gray-900">{r.count}</span>
                      <span className="text-gray-500">{r.reaction}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
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
              {data?.topWords.length ? data.topWords.map((w, i) => (
                <motion.span
                  key={w.word}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.04, duration: 0.3 }}
                  className={`${sizeClass(w.count, maxWordCount)} ${WORD_COLORS[i % WORD_COLORS.length]} leading-tight hover:scale-110 transition-transform cursor-default capitalize`}
                  aria-hidden="true"
                >
                  {w.word}
                </motion.span>
              )) : (
                <p className="text-gray-400 text-sm">Word cloud will appear once ideas are submitted.</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Category breakdown */}
        {data?.categoryBreakdown.length ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white rounded-3xl p-7 shadow-card border border-gray-50"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-500" />
              Ideas by Category
            </h2>
            <div className="space-y-5">
              {data.categoryBreakdown.map((row, i) => {
                const maxCat = data.categoryBreakdown[0].count;
                const pct = Math.round((row.count / maxCat) * 100);
                const colors = ['from-blue-400 to-blue-500', 'from-purple-400 to-purple-500', 'from-teal-400 to-teal-500', 'from-orange-400 to-orange-500'];
                return (
                  <div key={row.category} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600 w-36 truncate">{row.category}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${colors[i % colors.length]}`}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">{row.count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </div>
    </main>
  );
}
