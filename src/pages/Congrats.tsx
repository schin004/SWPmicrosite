import { motion } from 'framer-motion';
import { Gift, BarChart2, Home } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';

export default function Congrats() {
  const { setCurrentPage, setJourneyActive, setCurrentStep, setShowCongrats } = useJourney();

  const goHome = () => {
    setShowCongrats(false);
    setCurrentPage('home');
    setJourneyActive(false);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewPulse = () => {
    setShowCongrats(false);
    setCurrentPage('pulse');
    setJourneyActive(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 lg:px-8 pt-20 pb-24 text-center">

        {/* Trophy illustration */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, type: 'spring', damping: 10, stiffness: 90 }}
          className="relative inline-block mb-10"
        >
          <div className="w-44 h-44 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center mx-auto shadow-xl">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <span className="text-5xl">🏆</span>
            </div>
          </div>

          {/* Orbiting confetti */}
          {['🎉', '✨', '🌟', '💚', '🎊', '⭐'].map((emoji, i) => {
            const deg = i * 60;
            return (
              <motion.div
                key={i}
                className="absolute text-xl"
                style={{
                  top: `${50 + 56 * Math.sin((deg * Math.PI) / 180)}%`,
                  left: `${50 + 56 * Math.cos((deg * Math.PI) / 180)}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.09, duration: 0.4, type: 'spring' }}
              >
                {emoji}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="inline-flex items-center gap-2 bg-green-50 text-green-600 text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-green-200"
        >
          ✓ Journey Complete
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-5 tracking-tight"
        >
          Congratulations! 🎉
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-gray-600 text-xl max-w-lg mx-auto leading-relaxed mb-4"
        >
          You've completed the Future of Work Journey.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-500 text-base max-w-md mx-auto leading-relaxed mb-8"
        >
          By sharing your views and ideas, you've made a real contribution to shaping the future of work in Acme. Every voice matters — and yours has been heard.
        </motion.p>

        {/* Freebie card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-7 border border-yellow-200 shadow-card mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-100 flex items-center justify-center">
              <Gift className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="font-bold text-gray-900 text-lg">Claim Your Freebie!</p>
          </div>
          <p className="text-gray-700 text-base leading-relaxed mb-2">
            Head back to the <span className="font-semibold">Future of Work Booth</span> and show this screen to claim your complimentary gift.
          </p>
          <p className="text-orange-500 text-sm font-semibold">
            🎁 While stocks last — don't miss out!
          </p>
        </motion.div>

        {/* Floating emojis */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-5 mb-10"
        >
          {['🌱', '💡', '🚀', '🌳', '⚡'].map((emoji, i) => (
            <motion.span
              key={i}
              className="text-2xl"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {emoji}
            </motion.span>
          ))}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={viewPulse}
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <BarChart2 className="w-5 h-5" />
            View Live Pulse
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
