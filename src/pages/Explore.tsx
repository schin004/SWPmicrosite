import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, Trees, PawPrint, Bird, Telescope } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Idea {
  id: string;
  label: string;
  description: string;
}

interface Workgroup {
  id: string;
  icon: React.ElementType;
  emoji: string;
  title: string;
  accent: string;
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  ideas: Idea[];
}

const WORKGROUPS: Workgroup[] = [
  {
    id: 'urban-greenery',
    icon: Trees,
    emoji: '🌳',
    title: 'Urban Greenery and Parks Management',
    accent: 'teal',
    bg: 'from-teal-50 to-teal-100/40',
    border: 'border-b-teal-400',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    badgeBg: 'bg-teal-50 text-teal-600 border-teal-200',
    ideas: [
      { id: 'ai-inspections', label: 'AI-assisted inspections', description: 'Leveraging AI to automate routine park inspections could reduce manual effort, surface issues earlier and free staff to focus on higher-value stewardship and community engagement.' },
      { id: 'predictive-maintenance', label: 'Predictive maintenance', description: 'Using sensor data and analytics to predict when park infrastructure needs attention before failures occur — reducing downtime, lowering costs and improving visitor experience.' },
      { id: 'smart-irrigation', label: 'Smart irrigation', description: 'Intelligent, data-driven irrigation systems could optimise water usage across NParks green spaces, reducing waste and supporting sustainability goals while keeping landscapes healthy.' },
      { id: 'autonomous-landscaping', label: 'Autonomous landscaping', description: 'Robotic and autonomous landscaping tools could handle repetitive maintenance tasks, allowing skilled horticultural staff to focus on more complex and creative work.' },
      { id: 'digital-asset-mgmt', label: 'Digital asset management', description: 'A unified digital platform for tracking, managing and maintaining park assets — from benches to irrigation systems — could improve accountability, planning and resource allocation.' },
      { id: 'green-tech-skills', label: 'Skills for green technology', description: 'As parks become smarter, building staff capability in green technology — from IoT sensors to environmental monitoring tools — will be essential for future-ready operations.' },
    ],
  },
  {
    id: 'animal-health',
    icon: PawPrint,
    emoji: '🐾',
    title: 'Animal Health and Management',
    accent: 'purple',
    bg: 'from-purple-50 to-purple-100/40',
    border: 'border-b-purple-400',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    badgeBg: 'bg-purple-50 text-purple-600 border-purple-200',
    ideas: [
      { id: 'ai-diagnostics', label: 'AI-assisted diagnostics', description: 'AI-powered tools could assist veterinary teams with faster, more accurate diagnoses — improving animal outcomes and allowing clinicians to focus on complex cases requiring expert judgement.' },
      { id: 'welfare-analytics', label: 'Animal welfare analytics', description: 'Data analytics applied to animal health records could surface early warning signs, track welfare trends across populations and support evidence-based policy decisions.' },
      { id: 'vet-knowledge-sharing', label: 'Veterinary knowledge sharing', description: 'A structured platform for veterinary knowledge sharing across NParks teams could accelerate learning, reduce duplicated effort and strengthen the collective expertise of the organisation.' },
      { id: 'case-management', label: 'Smarter case management', description: 'Modernising case management systems could streamline how animal health cases are logged, tracked and resolved — reducing administrative burden and improving continuity of care.' },
      { id: 'digital-health-records', label: 'Digital health records', description: 'Centralised, accessible digital health records for animals under NParks care would improve coordination across teams, support audit readiness and enable better longitudinal health tracking.' },
      { id: 'cross-functional-training', label: 'Cross-functional training', description: 'Structured cross-functional training between animal health, wildlife management and forensic teams could build shared capability and a more integrated approach to animal welfare.' },
    ],
  },
  {
    id: 'wildlife-forensics',
    icon: Bird,
    emoji: '🦅',
    title: 'Wildlife Management and Forensics',
    accent: 'orange',
    bg: 'from-orange-50 to-orange-100/40',
    border: 'border-b-orange-400',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    badgeBg: 'bg-orange-50 text-orange-500 border-orange-200',
    ideas: [
      { id: 'drone-monitoring', label: 'Drone-assisted monitoring', description: 'Drones could transform wildlife monitoring by covering large areas quickly, accessing difficult terrain and providing real-time data — reducing risk to staff and improving survey accuracy.' },
      { id: 'dna-analysis', label: 'Wildlife DNA analysis', description: 'Advanced DNA analysis capabilities could strengthen wildlife forensic investigations, support biodiversity research and provide stronger evidence for wildlife crime enforcement.' },
      { id: 'digital-evidence', label: 'Digital evidence management', description: 'A robust digital evidence management system would improve the integrity, traceability and accessibility of forensic evidence — supporting both legal proceedings and research outcomes.' },
      { id: 'ai-species-id', label: 'AI species identification', description: 'AI-powered species identification tools could accelerate field assessments, reduce reliance on manual expertise for routine identification tasks and improve the accuracy of ecological surveys.' },
      { id: 'incident-automation', label: 'Incident response automation', description: 'Automated incident response workflows could help teams act faster on wildlife sightings, conflicts or illegal activity — ensuring timely, coordinated and well-documented responses.' },
      { id: 'forensic-capabilities', label: 'Future forensic capabilities', description: 'Investing in next-generation forensic capabilities — from portable field labs to AI-assisted analysis — would position NParks as a leader in wildlife forensics across the region.' },
    ],
  },
];

const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love it' },
  { id: 'useful', emoji: '👍', label: 'Useful' },
  { id: 'needs-thought', emoji: '🤔', label: 'Needs more thought' },
  { id: 'interesting', emoji: '💡', label: 'Interesting' },
];

// ─── Idea Modal ───────────────────────────────────────────────────────────────

interface ModalState {
  idea: Idea;
  workgroupId: string;
}

interface IdeaModalProps {
  modal: ModalState;
  reactions: Record<string, string>;
  comments: Record<string, string>;
  onReact: (ideaId: string, reactionId: string) => void;
  onComment: (ideaId: string, text: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function IdeaModal({ modal, reactions, comments, onReact, onComment, onSave, onClose }: IdeaModalProps) {
  const { idea } = modal;
  const currentReaction = reactions[idea.id] || '';
  const currentComment = comments[idea.id] || '';
  const [saved, setSaved] = useState(false);
  const MAX = 300;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 900);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal panel */}
      <motion.div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-3xl px-7 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Idea</p>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{idea.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-7 py-5 space-y-6">
          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed">{idea.description}</p>

          {/* Reactions */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">What do you think about this idea?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {REACTIONS.map(r => {
                const active = currentReaction === r.id;
                return (
                  <motion.button
                    key={r.id}
                    onClick={() => onReact(idea.id, active ? '' : r.id)}
                    whileTap={{ scale: 0.93 }}
                    className={`
                      flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-medium transition-all duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                      ${active
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300 text-blue-700 shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                      }
                    `}
                    aria-pressed={active}
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span>{r.label}</span>
                    {active && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-2 h-2 rounded-full bg-blue-500"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Reflection textarea */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              How would you Ctrl. Alt. Delete. this idea?
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Share how you would improve, rethink or reset this idea for the future of work.
            </p>
            <textarea
              value={currentComment}
              onChange={e => e.target.value.length <= MAX && onComment(idea.id, e.target.value)}
              placeholder="For example, what would you keep (Ctrl), improve (Alt), or stop doing (Delete)?"
              className="w-full min-h-28 p-4 rounded-2xl border border-gray-200 bg-gray-50/60 text-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder-gray-400 leading-relaxed"
              aria-label="Your thoughts on this idea"
            />
            <div className="flex justify-end mt-1.5">
              <span className={`text-xs tabular-nums ${MAX - currentComment.length < 50 ? 'text-orange-500' : 'text-gray-400'}`}>
                {MAX - currentComment.length} characters remaining
              </span>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className={`
              w-full flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-2xl transition-all duration-300
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              ${saved
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5'
              }
            `}
          >
            {saved ? (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                ✓ Saved!
              </motion.span>
            ) : (
              'Save My Thoughts'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Workgroup Card ───────────────────────────────────────────────────────────

interface WorkgroupCardProps {
  wg: Workgroup;
  wgComment: string;
  onIdeaClick: (idea: Idea, wgId: string) => void;
  onWgCommentChange: (wgId: string, text: string) => void;
  ideaReactions: Record<string, string>;
}

const MAX_WG = 300;

function WorkgroupCard({ wg, wgComment, onIdeaClick, onWgCommentChange, ideaReactions }: WorkgroupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`bg-gradient-to-br ${wg.bg} rounded-3xl p-7 border border-gray-100 border-b-4 ${wg.border} shadow-card hover:shadow-card-hover transition-shadow duration-200 flex flex-col gap-6`}
    >
      {/* Card header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl ${wg.iconBg} flex items-center justify-center flex-shrink-0`}>
          <wg.icon className={`w-6 h-6 ${wg.iconColor}`} />
        </div>
        <div>
          <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${wg.badgeBg} mb-2`}>
            Workgroup
          </span>
          <h3 className="text-lg font-bold text-gray-900 leading-snug">{wg.title}</h3>
        </div>
      </div>

      {/* Idea chips */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ideas from this workgroup</p>
        <div className="flex flex-wrap gap-2">
          {wg.ideas.map(idea => {
            const hasReaction = Boolean(ideaReactions[idea.id]);
            return (
              <button
                key={idea.id}
                onClick={() => onIdeaClick(idea, wg.id)}
                className={`
                  group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  ${hasReaction
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm'
                  }
                `}
                aria-label={`Explore idea: ${idea.label}`}
              >
                {hasReaction && <span className="text-xs">✓</span>}
                {idea.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional workgroup contribution */}
      <div className="pt-4 border-t border-gray-200/60">
        <p className="text-sm font-semibold text-gray-800 mb-1">
          How would you Ctrl. Alt. Delete. the way this workgroup works?
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Share one suggestion that could help this workgroup prepare for the future.
        </p>
        <textarea
          value={wgComment}
          onChange={e => e.target.value.length <= MAX_WG && onWgCommentChange(wg.id, e.target.value)}
          placeholder="Share your thoughts here..."
          rows={3}
          className="w-full p-4 rounded-2xl border border-gray-200 bg-white/70 text-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder-gray-400 leading-relaxed"
          aria-label={`Contribution for ${wg.title}`}
        />
        <div className="flex justify-end mt-1.5">
          <span className={`text-xs tabular-nums ${MAX_WG - wgComment.length < 50 ? 'text-orange-500' : 'text-gray-400'}`}>
            {MAX_WG - wgComment.length} characters remaining
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function Explore() {
  const { completeStep, setCurrentStep } = useJourney();
  const [openModal, setOpenModal] = useState<ModalState | null>(null);
  const [ideaReactions, setIdeaReactions] = useState<Record<string, string>>({});
  const [ideaComments, setIdeaComments] = useState<Record<string, string>>({});
  const [wgComments, setWgComments] = useState<Record<string, string>>({});

  const handleReact = (ideaId: string, reactionId: string) => {
    setIdeaReactions(prev => ({ ...prev, [ideaId]: reactionId }));
  };

  const handleIdeaComment = (ideaId: string, text: string) => {
    setIdeaComments(prev => ({ ...prev, [ideaId]: text }));
  };

  const handleWgComment = (wgId: string, text: string) => {
    setWgComments(prev => ({ ...prev, [wgId]: text }));
  };

  const handleContinue = () => {
    completeStep(2); // Explore = step 2
    setCurrentStep(3); // → Imagine
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-24">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-500 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-orange-100">
            <Telescope className="w-4 h-4" />
            Step 2 of 4
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Explore the{' '}
            <span className="gradient-text">Ideas</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Explore ideas developed by different NParks workgroups during the Strategic Workforce Planning workshops.
            Click on any idea to learn more, share your perspective, or contribute your own thoughts.
          </p>
          <p className="text-sm text-gray-400 mt-3">All interactions are optional — feel free to explore at your own pace.</p>
        </motion.div>

        {/* Workgroup cards — 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {WORKGROUPS.map((wg, i) => (
            <motion.div
              key={wg.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
            >
              <WorkgroupCard
                wg={wg}
                wgComment={wgComments[wg.id] || ''}
                onIdeaClick={(idea, wgId) => setOpenModal({ idea, workgroupId: wgId })}
                onWgCommentChange={handleWgComment}
                ideaReactions={ideaReactions}
              />
            </motion.div>
          ))}
        </div>

        {/* Continue CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <button
            onClick={handleContinue}
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Continue to Imagine
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>

      {/* Idea modal */}
      <AnimatePresence>
        {openModal && (
          <IdeaModal
            modal={openModal}
            reactions={ideaReactions}
            comments={ideaComments}
            onReact={handleReact}
            onComment={handleIdeaComment}
            onSave={() => setOpenModal(null)}
            onClose={() => setOpenModal(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
