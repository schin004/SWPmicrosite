import React, { createContext, useContext, useState } from 'react';

export type Step = 1 | 2 | 3 | 4;
export type Page = 'home' | 'journey' | 'pulse' | 'about';

// Stable session ID for the browser tab — persists across React re-renders
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
  ideaText: string;
  setIdeaText: (t: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
}

const JourneyContext = createContext<JourneyContextType | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(getSessionId);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [journeyActive, setJourneyActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [showCongrats, setShowCongrats] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const completeStep = (s: Step) => {
    setCompletedSteps(prev => new Set([...prev, s]));
  };

  return (
    <JourneyContext.Provider value={{
      sessionId,
      currentPage, setCurrentPage,
      journeyActive, setJourneyActive,
      currentStep, setCurrentStep,
      completedSteps, completeStep,
      showCongrats, setShowCongrats,
      ideaText, setIdeaText,
      selectedCategory, setSelectedCategory,
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
