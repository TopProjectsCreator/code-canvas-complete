import { useEffect, useCallback } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { WelcomeSplash } from "./WelcomeSplash";
import { WalkthroughTour } from "./WalkthroughTour";

const shouldAutoOpenOnboarding = () => {
  if (typeof window === "undefined") return false;
  const { pathname } = window.location;
  return (
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/editor" ||
    pathname.startsWith("/project/")
  );
};

export const OnboardingManager = () => {
  const { isOpen, phase, hasSeenOnboarding, startWelcome, skip } = useOnboarding();

  useEffect(() => {
    if (!hasSeenOnboarding && shouldAutoOpenOnboarding()) {
      const timer = setTimeout(() => {
        if (shouldAutoOpenOnboarding()) startWelcome();
      }, 600);
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
