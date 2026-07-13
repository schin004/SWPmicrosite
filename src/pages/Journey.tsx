import { motion, AnimatePresence } from 'framer-motion';
import ProgressIndicator from '../components/ProgressIndicator';
import Learn from './Learn';
import Explore from './Explore';
import Imagine from './Imagine';
import Ready from './Ready';
import Congrats from './Congrats';
import { useJourney } from '../context/JourneyContext';

const pageVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

export default function Journey() {
  const { currentStep, showCongrats, userLoaded } = useJourney();

  if (!userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading your progress…</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar — hide on congrats screen */}
      {!showCongrats && (
        <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3">
            <ProgressIndicator />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showCongrats ? (
          <motion.div
            key="congrats"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Congrats />
          </motion.div>
        ) : (
          <motion.div
            key={currentStep}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {currentStep === 1 && <Learn />}
            {currentStep === 2 && <Explore />}
            {currentStep === 3 && <Imagine />}
            {currentStep === 4 && <Ready />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
