import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, Trees, PawPrint, Bird, Telescope } from 'lucide-react';
import { useJourney } from '../context/JourneyContext';
import { saveIdeaReaction } from '../lib/db';

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
      { id: 'ugpm_operator_to_orchestrator', label: 'From Operator to Orchestrator', description: `NParks could work more deliberately with industry, IHLs and community partners on clearly defined areas where they can contribute more effectively, redesigning how we partner so that their interests are genuinely aligned with the outcomes we want. NParks will continue to lead strategically, set standards and remain accountable for outcomes, public safety and public trust.` },
      { id: 'ugpm_neighbourhood_stewards', label: 'Empowering Communities as Neighbourhood Stewards', description: `NParks will explore how community groups can take on more meaningful stewardship of their neighbourhood green spaces, including making decisions about how spaces are used and cared for. This could be tested through pilots like Bishan-Ang Mo Kio Park, with NParks remaining accountable for public safety and maintenance standards.` },
      { id: 'ugpm_organising_teams', label: 'Organising Teams Around the Work', description: `Some work may be best done by area-based teams who know their patch deeply. Other work - like policy, standards and systems - may be best done by project-based teams that cut across the organisation. We could consider how to re-organise ourselves so that we have the right people and the right focus for each team, and test these models through pilots or paper exercises before considering broader structural changes.` },
      { id: 'ugpm_specialist_expertise', label: 'Deepening Specialist Expertise', description: `Greater complexity in our work calls for greater depth in our people.

NParks will clarify future competencies and career pathways so that officers can deepen expertise in areas such as arboriculture, horticulture, plant health, ecology and operations technology, building specialist depth alongside generalist breadth.` },
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
      { id: 'ahm_data_decisions', label: 'Strengthening Data for Better Decisions', description: `NParks will start by reviewing the data we collect and use today, then identify 2 to 3 priority use cases where better-integrated data can improve day-to-day decisions. This will also inform how cross-functional teams, bringing together domain officers, data analysts, engagement staff and IT support, can work together more effectively on biosurveillance priorities.` },
      { id: 'ahm_ai_disease_detection', label: 'Use AI to Detect Disease Threats Earlier', description: `We could build an AI-enabled early warning system that monitors multiple data streams (outbreak databases, environmental signals, animal movement patterns) and generates risk alerts before threats escalate. We could start with 2 to 3 priority disease scenarios as proof of concept, then expand to a broader predictive biosurveillance system over time. This will include building staff capability to work effectively with AI tools and interpret outputs.` },
      { id: 'ahm_data_ai_specialists', label: 'Develop Animal Health Specialists with Data and AI Skills', description: `We envision that the future animal health officer is not just trained in biosecurity and risk assessment, but also equipped to work with data, use AI tools and communicate findings to the public. We could build these horizontal capabilities into the specialist role, so officers can act on intelligence directly rather than waiting for IT or data teams to interpret it for them.` },
      { id: 'ahm_high_value_work', label: 'Freeing Specialists to Focus on High-Value Work', description: `NParks officers currently spend significant time on administrative tasks that take them away from core scientific and operational work. We will review which of these tasks can be automated, reassigned or shared with dedicated support functions—including understanding how functions like inspections and permit processing will continue to be handled—so specialists can focus on high-value work.` },
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
      { id: 'wmf_conservation_outcomes', label: 'Strengthening Conservation Outcomes', description: `We envision a shift reflecting a stronger focus on conservation outcomes while continuing to manage public safety, feedback and operational realities. This includes strengthening ecological literacy and public coexistence through schools, communities and public education partners, and exploring how land owners can play a clearer role in mitigating wildlife-related issues on their premises. This reframing will have to be supported by practical changes to roles, processes and ways of working.` },
      { id: 'wmf_proactive_wildlife_management', label: 'Using Data and Research for Proactive Wildlife Management', description: `We will use data, dashboards and long-term population research to support proactive, evidence-based wildlife management. This includes better triaging of cases so that officers can focus on complex, high-judgement situations while routine cases are supported by trained partners under NParks' guidance.` },
      { id: 'wmf_wildlife_veterinary_capability', label: 'Exploring a Stronger Wildlife Veterinary Capability', description: `We will study the feasibility of strengthening CWR's specialist wildlife veterinary capability, including the manpower, funding, training, research and public trust benefits required to support a stronger long-term model for wildlife care.` },
      { id: 'wmf_regional_wildlife_forensics', label: 'Building Singapore as a Trusted Regional Partner for Wildlife Forensics', description: `The long-term ambition is for Singapore to be a trusted regional partner for wildlife forensics, intelligence-sharing and scientific collaboration. To achieve this, we will work with IHL partners, regional counterparts and international networks to strengthen capability, share research direction and build the partnerships that underpin Singapore's role as a trade and travel hub committed to tackling wildlife trafficking.` },
      { id: 'wmf_intelligence_led_enforcement', label: 'Moving Toward Intelligence-Led Enforcement', description: `We could identify AI-enabled horizon scanning use cases to understand emerging wildlife trade signals, high-risk routes and trafficking networks. This will have to be supported by digitising the chain of custody end-to-end, and building a well-curated reference database and sample archive so that test development and species identification can be done faster and with greater confidence. This includes clarifying how NParks connects to transboundary crime intelligence networks and regional enforcement partners.` },
      { id: 'wmf_science_technology_bridges', label: 'Develop Staff as Operational Bridges Between Science and Technology', description: `As AI and digital tools become central to forensic work, we envision that the role of the wildlife trade specialist evolves from manual monitoring and report-reading to validating AI outputs, contextualising data for criminal intelligence and translating insights into policy. Building this capability requires deliberate investment in how staff understand and work with technology, not just technical training.` },
    ],
  },
];

const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love it' },
  { id: 'useful', emoji: '👍', label: 'Useful' },
  { id: 'needs-thought', emoji: '🤔', label: 'Needs more thought' },
  { id: 'interesting', emoji: '💡', label: 'Tell me more' },
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

  // Lock background scroll while the modal is open so the page behind
  // doesn't interfere with modal scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 900);
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] overflow-y-auto flex items-start justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop — fixed so it always covers the viewport, even while the overlay scrolls */}
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal panel — sits at top with breathing room; whole overlay scrolls if tall */}
      <motion.div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg my-auto"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      >
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-t-3xl px-7 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
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
          {/* Description — supports multiple paragraphs split on blank lines */}
          <div className="space-y-3">
            {idea.description.split('\n\n').map((para, i) => (
              <p key={i} className="text-gray-600 text-sm leading-relaxed">{para}</p>
            ))}
          </div>

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
    </motion.div>,
    document.body
  );
}

// ─── Workgroup Card ───────────────────────────────────────────────────────────

interface WorkgroupCardProps {
  wg: Workgroup;
  onIdeaClick: (idea: Idea, wgId: string) => void;
  ideaReactions: Record<string, string>;
}

function WorkgroupCard({ wg, onIdeaClick, ideaReactions }: WorkgroupCardProps) {
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
                  group flex items-start gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium border text-left leading-snug transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  ${hasReaction
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm'
                  }
                `}
                aria-label={`Explore idea: ${idea.label}`}
              >
                {hasReaction && <span className="text-xs mt-0.5 flex-shrink-0">✓</span>}
                <span>{idea.label}</span>
              </button>
            );
          })}
        </div>
      </div>

    </motion.div>
  );
}

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function Explore() {
  const {
    sessionId, completeStep, setCurrentStep,
    ideaReactions, setIdeaReactions,
    ideaComments, setIdeaComments,
  } = useJourney();
  const [openModal, setOpenModal] = useState<ModalState | null>(null);

  const handleReact = (ideaId: string, reactionId: string) => {
    setIdeaReactions(prev => ({ ...prev, [ideaId]: reactionId }));
  };

  const handleIdeaComment = (ideaId: string, text: string) => {
    setIdeaComments(prev => ({ ...prev, [ideaId]: text }));
  };

  const handleModalSave = () => {
    if (!openModal) return;
    const { idea, workgroupId } = openModal;
    saveIdeaReaction({
      sessionId,
      workgroupId,
      ideaId: idea.id,
      ideaLabel: idea.label,
      reaction: ideaReactions[idea.id] || '',
      comment: ideaComments[idea.id] || '',
    });
    setOpenModal(null);
  };

  const handleContinue = () => {
    completeStep(2);
    setCurrentStep(3);
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
            These are early-stage ideas being explored by different NParks workgroups during the Strategic Workforce Planning workshops — starting points for discussion.
            Click on any idea to learn more, share your perspective, or contribute your own thoughts.
          </p>
          <p className="text-sm text-gray-400 mt-3">Click on any idea to learn more and share your perspective.</p>
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
                onIdeaClick={(idea, wgId) => setOpenModal({ idea, workgroupId: wgId })}
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
            onSave={handleModalSave}
            onClose={() => setOpenModal(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
