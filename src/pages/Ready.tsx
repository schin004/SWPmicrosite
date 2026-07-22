import { motion } from 'framer-motion';
import { Camera, MapPin, Star, Home } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';
import { recordPledge } from '../lib/db';

export default function Ready() {
  const { sessionId, completeStep, setCurrentPage, setJourneyActive, setCurrentStep, setShowCongrats } = useJourney();

  const handlePledge = () => {
    recordPledge(sessionId);
    completeStep(4);
    setShowCongrats(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = () => {
    setCurrentPage('home');
    setJourneyActive(false);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 lg:px-8 pt-20 pb-24 text-center">

        {/* Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: 'spring', damping: 12, stiffness: 100 }}
          className="relative inline-block mb-10"
        >
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto shadow-xl">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center shadow-lg">
              <Camera className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Floating sparkles */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <motion.div
              key={deg}
              className="absolute"
              style={{
                top: `${50 + 52 * Math.sin((deg * Math.PI) / 180)}%`,
                left: `${50 + 52 * Math.cos((deg * Math.PI) / 180)}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 1, 0.7] }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
            >
              <Star
                className={`w-4 h-4 ${['text-blue-400', 'text-purple-400', 'text-teal-400', 'text-orange-400', 'text-pink-400', 'text-indigo-400'][i]}`}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Step badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 bg-orange-50 text-orange-500 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-orange-100"
        >
          <Star className="w-4 h-4" />
          Step 4 of 4 — Pledge
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-5 tracking-tight"
        >
          One Last Step...
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-gray-600 text-xl max-w-lg mx-auto leading-relaxed mb-8"
        >
          Head over to the <span className="font-semibold text-gray-900">Future of Work Booth</span> and take a photo of your pledge.
        </motion.p>

        {/* Booth instruction card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-white rounded-3xl p-7 shadow-card border border-gray-100 mb-8 text-left"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            <p className="font-semibold text-gray-900">How to make your pledge</p>
          </div>
          <ol className="space-y-4">
            {[
              { emoji: '📍', text: 'Find the Future of Work Booth at the conference venue.' },
              { emoji: '✍️', text: 'Write your personal pledge for the future of work at Acme on the pledge card provided.' },
              { emoji: '📸', text: 'Take a photo of yourself holding your pledge card at the booth.' },
              { emoji: '✅', text: 'Come back here and click the button below once you\'ve made your pledge.' },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{step.emoji}</span>
                <span className="text-gray-600 text-sm leading-relaxed">{step.text}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={handlePledge}
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-10 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 text-lg"
          >
            <Camera className="w-5 h-5" />
            I've made my pledge
          </button>
          <button
            onClick={goHome}
            className="inline-flex items-center gap-2 bg-white text-gray-700 font-medium px-6 py-4 rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 border border-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </motion.div>
      </div>
    </main>
  );
}
