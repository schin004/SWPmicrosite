import { AnimatePresence, motion } from 'framer-motion';
import { JourneyProvider, useJourney } from './context/JourneyContext';
import Navigation from './components/Navigation';
import BackgroundDecor from './components/BackgroundDecor';
import Footer from './components/Footer';
import Home from './pages/Home';
import Journey from './pages/Journey';
import Pulse from './pages/Pulse';
import About from './pages/About';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function AppInner() {
  const { currentPage } = useJourney();

  return (
    <div className="relative min-h-screen">
      <BackgroundDecor />
      <Navigation />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {currentPage === 'home' && <Home />}
          {currentPage === 'journey' && <Journey />}
          {currentPage === 'pulse' && <Pulse />}
          {currentPage === 'about' && <About />}
        </motion.div>
      </AnimatePresence>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <JourneyProvider>
      <AppInner />
    </JourneyProvider>
  );
}
