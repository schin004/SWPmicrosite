import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Briefcase, Cpu, GitBranch, Heart, Compass } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';
import { submitIdea } from '../lib/db';

// id = label so the saved category value matches the visible label.
const CATEGORIES = [
  { id: 'Work Priorities & Processes', label: 'Work Priorities & Processes', icon: Briefcase, color: 'blue' },
  { id: 'Technology & AI', label: 'Technology & AI', icon: Cpu, color: 'purple' },
  { id: 'Skills & Careers', label: 'Skills & Careers', icon: GitBranch, color: 'teal' },
  { id: 'Collaboration & Culture', label: 'Collaboration & Culture', icon: Heart, color: 'orange' },
  { id: 'Leadership & Support', label: 'Leadership & Support', icon: Compass, color: 'green' },
  { id: 'Others', label: 'Others', icon: Sparkles, color: 'red' },
];

const COLOR_MAP: Record<string, { pill: string; active: string }> = {
  blue: { pill: 'border-blue-200 text-blue-600 hover:bg-blue-50', active: 'bg-blue-500 text-white border-blue-500' },
  purple: { pill: 'border-purple-200 text-purple-600 hover:bg-purple-50', active: 'bg-purple-500 text-white border-purple-500' },
  teal: { pill: 'border-teal-200 text-teal-600 hover:bg-teal-50', active: 'bg-teal-500 text-white border-teal-500' },
  orange: { pill: 'border-orange-200 text-orange-500 hover:bg-orange-50', active: 'bg-orange-400 text-white border-orange-400' },
  green: { pill: 'border-green-200 text-green-600 hover:bg-green-50', active: 'bg-green-500 text-white border-green-500' },
  red: { pill: 'border-red-200 text-red-500 hover:bg-red-50', active: 'bg-red-400 text-white border-red-400' },
};

const MAX_CHARS = 500;

export default function Imagine() {
  const { sessionId, ideaText, setIdeaText, selectedCategory, setSelectedCategory, setCurrentStep, completeStep } = useJourney();
  const remaining = MAX_CHARS - ideaText.length;
  const canSubmit = ideaText.trim().length > 0;

  const handleNext = () => {
    if (!canSubmit) return;
    submitIdea({ sessionId, ideaText, category: selectedCategory });
    completeStep(3);
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 pt-28 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-600 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-purple-100">
            <Sparkles className="w-4 h-4" />
            Step 3 of 4
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            <span className="gradient-text">Imagine</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            If you could improve one thing about the future of work at Acme, what would it be?
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-card border border-gray-50"
        >
          {/* Category pills */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">Choose a category</p>
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Idea categories">
              {CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat.id;
                const colors = COLOR_MAP[cat.color];
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isActive ? '' : cat.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                      ${isActive ? colors.active : `bg-white ${colors.pill}`}
                    `}
                    aria-pressed={isActive}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text area */}
          <div className="mb-3">
            <label htmlFor="idea-input" className="text-sm font-semibold text-gray-700 mb-3 block">
              Your idea
            </label>
            <textarea
              id="idea-input"
              value={ideaText}
              onChange={e => {
                if (e.target.value.length <= MAX_CHARS) setIdeaText(e.target.value);
              }}
              placeholder="What would you improve, rethink, or reset about the future of work at Acme?"
              className="w-full min-h-44 p-5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-800 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder-gray-400 leading-relaxed"
              aria-label="Share your idea"
              aria-describedby="char-count"
            />
          </div>

          {/* Character counter */}
          <div id="char-count" className="flex items-center justify-between mb-8">
            <p className="text-xs text-gray-400">
              💡 Your idea will be saved to your conference session
            </p>
            <span
              className={`text-sm font-medium tabular-nums ${
                remaining < 50 ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              {remaining} characters remaining
            </span>
          </div>

          {/* Submit button */}
          <button
            onClick={handleNext}
            disabled={!canSubmit}
            className={`
              group w-full flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
              ${canSubmit
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            aria-disabled={!canSubmit}
          >
            Submit My Idea
            <ArrowRight className={`w-5 h-5 ${canSubmit ? 'group-hover:translate-x-1 transition-transform' : ''}`} />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
