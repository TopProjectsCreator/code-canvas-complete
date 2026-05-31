import { useEffect, useCallback } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { WelcomeSplash } from "./WelcomeSplash";
import { WalkthroughTour } from "./WalkthroughTour";

export const OnboardingManager = () => {
  const { isOpen, phase, hasSeenOnboarding, startWelcome, skip } = useOnboarding();

  useEffect(() => {
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => startWelcome(), 600);
      return () => clearTimeout(timer);
    }
  }, [hasSeenOnboarding, startWelcome]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        skip();
      }
    },
    [isOpen, skip],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isOpen && phase === "welcome") {
    return <WelcomeSplash />;
  }

  if (isOpen && phase === "walkthrough") {
    return <WalkthroughTour />;
  }

  return null;
};
