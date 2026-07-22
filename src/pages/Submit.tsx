import { motion } from 'framer-motion';
import { Send, CheckCircle, ArrowRight, Quote } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';

export default function Submit() {
  const { ideaText, selectedCategory, setCurrentStep, completeStep } = useJourney();

  const handleSubmit = () => {
    completeStep(3);
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const categoryLabel: Record<string, string> = {
    skills: 'Skills',
    technology: 'Technology',
    'ways-of-working': 'Ways of Working',
    'workplace-culture': 'Workplace Culture',
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-600 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-teal-100">
            <Send className="w-4 h-4" />
            Step 3 of 4
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Share Your{' '}
            <span className="gradient-text">Idea</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            Review your submission before sending it to help shape Acme future.
          </p>
        </motion.div>

        {/* Preview card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white rounded-3xl p-8 shadow-card border border-gray-50 mb-6"
        >
          {selectedCategory && (
            <span className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border border-blue-100 mb-5">
              {categoryLabel[selectedCategory] || selectedCategory}
            </span>
          )}

          <div className="flex gap-3">
            <Quote className="w-5 h-5 text-purple-300 mt-1 flex-shrink-0" />
            <p className="text-gray-700 text-base leading-relaxed italic">
              {ideaText || 'No idea text entered.'}
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
              You
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Acme Staff</div>
              <div className="text-xs text-gray-400">SWP Conference 2025</div>
            </div>
          </div>
        </motion.div>

        {/* What happens next */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100/50 mb-8"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 mb-1">What happens to your idea?</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your submission contributes to Acme Future of Work Pulse — a live dashboard showing collective insights from all participants. Your idea helps leadership understand workforce priorities.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Submit button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <button
            onClick={handleSubmit}
            className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Submit My Idea
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}
