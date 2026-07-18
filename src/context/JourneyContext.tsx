import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadUserProgress } from '../lib/db';

export type Step = 1 | 2 | 3 | 4;
export type Page = 'home' | 'journey' | 'pulse' | 'about';

function getSessionId() {
  const key = 'swp_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

interface JourneyContextType {
  sessionId: string;
  userLoaded: boolean;

  currentPage: Page;
  setCurrentPage: (p: Page) => void;

  journeyActive: boolean;
  setJourneyActive: (v: boolean) => void;

  currentStep: Step;
  setCurrentStep: (s: Step) => void;

  completedSteps: Set<Step>;
  completeStep: (s: Step) => void;

  showCongrats: boolean;
  setShowCongrats: (v: boolean) => void;

  // Imagine
  ideaText: string;
  setIdeaText: (t: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;

  // Explore — keyed by idea ID
  ideaReactions: Record<string, string>;
  setIdeaReactions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  ideaComments: Record<string, string>;
  setIdeaComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Workgroup free-text contributions keyed by workgroup ID
  wgComments: Record<string, string>;
  setWgComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const JourneyContext = createContext<JourneyContextType | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(getSessionId);
  const [userLoaded, setUserLoaded] = useState(false);

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [journeyActive, setJourneyActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [showCongrats, setShowCongrats] = useState(false);

  const [ideaText, setIdeaText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [ideaReactions, setIdeaReactions] = useState<Record<string, string>>({});
  const [ideaComments, setIdeaComments] = useState<Record<string, string>>({});
  const [wgComments, setWgComments] = useState<Record<string, string>>({});

  const completeStep = (s: Step) => {
    setCompletedSteps(prev => new Set([...prev, s]));
  };

  // Hydrate saved progress from the backend (Neon) on first load
  useEffect(() => {
    loadUserProgress(sessionId).then(progress => {
      // Restore Explore state
      const reactions: Record<string, string> = {};
      const comments: Record<string, string> = {};
      Object.entries(progress.reactions).forEach(([ideaId, val]) => {
        if (val.reaction) reactions[ideaId] = val.reaction;
        if (val.comment) comments[ideaId] = val.comment;
      });
      setIdeaReactions(reactions);
      setIdeaComments(comments);
      setWgComments(progress.contributions);

      // Restore Imagine state
      if (progress.idea) {
        setIdeaText(progress.idea.idea_text);
        setSelectedCategory(progress.idea.category ?? '');
      }

      // Restore completed steps
      const done = new Set<Step>();
      const hasExploreData =
        Object.keys(progress.reactions).length > 0 ||
        Object.keys(progress.contributions).length > 0;

      if (hasExploreData) { done.add(1); done.add(2); }
      if (progress.idea) { done.add(1); done.add(2); done.add(3); }
      if (progress.hasPledge) { done.add(1); done.add(2); done.add(3); done.add(4); }

      setCompletedSteps(done);

      // Resume at the right step
      if (progress.hasPledge) {
        setCurrentStep(4);
        setShowCongrats(true);
      } else if (progress.idea) {
        setCurrentStep(4);
      } else if (hasExploreData) {
        setCurrentStep(3);
      }

      setUserLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <JourneyContext.Provider value={{
      sessionId,
      userLoaded,
      currentPage, setCurrentPage,
      journeyActive, setJourneyActive,
      currentStep, setCurrentStep,
      completedSteps, completeStep,
      showCongrats, setShowCongrats,
      ideaText, setIdeaText,
      selectedCategory, setSelectedCategory,
      ideaReactions, setIdeaReactions,
      ideaComments, setIdeaComments,
      wgComments, setWgComments,
    }}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used within JourneyProvider');
  return ctx;
}
