import { motion } from 'framer-motion';
import Logo from './Logo';

// Branded loading / splash screen used while data loads.
export default function Splash({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Logo variant="full" className="h-14 w-auto" title="Ctrl Alt Del" />
      </motion.div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-ctrl border-t-brand-navy rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </div>
    </div>
  );
}
