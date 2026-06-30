import { useState } from 'react';
import { motion } from 'framer-motion';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export default function FlipCard({ front, back, className = '', minHeight = '280px' }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flip-card cursor-pointer ${className}`}
      style={{ minHeight }}
      onClick={() => setFlipped(v => !v)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFlipped(v => !v)}
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Click to flip back' : 'Click to flip card for more details'}
    >
      <motion.div
        className="flip-card-inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d', minHeight }}
      >
        <div className="flip-card-front" style={{ minHeight }}>
          {front}
        </div>
        <div className="flip-card-back" style={{ minHeight }}>
          {back}
        </div>
      </motion.div>
    </div>
  );
}
