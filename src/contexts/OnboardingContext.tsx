import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type OnboardingPhase = "welcome" | "walkthrough" | null;

interface OnboardingContextType {
  isOpen: boolean;
  phase: OnboardingPhase;
  currentStep: number;
  totalSteps: number;
  hasSeenOnboarding: boolean;
  startWelcome: () => void;
  startWalkthrough: () => void;
  requestWalkthrough: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  skip: () => void;
  complete: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = "ide-onboarding-seen";

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 6;

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setHasSeenOnboarding(true);
  }, []);

  const startWelcome = useCallback(() => {
    setCurrentStep(0);
    setPhase("welcome");
    setIsOpen(true);
  }, []);

  const startWalkthrough = useCallback(() => {
    setCurrentStep(0);
    setPhase("walkthrough");
    setIsOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
  }, [totalSteps]);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    setPhase(null);
    setCurrentStep(0);
  }, []);

  const skip = useCallback(() => {
    markSeen();
    dismiss();
  }, [markSeen, dismiss]);

  const complete = useCallback(() => {
    markSeen();
    dismiss();
  }, [markSeen, dismiss]);

  const requestWalkthrough = useCallback(() => {
    startWalkthrough();
  }, [startWalkthrough]);

  return (
    <OnboardingContext.Provider
      value={{
        isOpen,
        phase,
        currentStep,
        totalSteps,
        hasSeenOnboarding,
        startWelcome,
        startWalkthrough,
        requestWalkthrough,
        nextStep,
        prevStep,
        goToStep,
        skip,
        complete,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
};
