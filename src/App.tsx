import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
import { DiscordProvider } from "@/contexts/DiscordContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Docs from "./pages/Docs";
import ProfilePage from "./pages/Profile";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsOfUsePage from "./pages/TermsOfUse";
import Compare from "./pages/Compare";
import FTCPage from "./pages/FTC";
import ArduinoPage from "./pages/Arduino";
import OfficePage from "./pages/Office";
import AutomationsPage from "./pages/Automations";
import ScratchPage from "./pages/Scratch";
import CadPage from "./pages/CadPage";
import AuthBridge from "./pages/AuthBridge";
import AuthLink from "./pages/AuthLink";
import AuthLogout from "./pages/AuthLogout";
import AuthCallback from "./pages/AuthCallback";
import LinkDiscord from "./pages/LinkDiscord";
import ResetPassword from "./pages/ResetPassword";
import OAuthHostsAdmin from "./pages/admin/OAuthHosts";
import { LivingGrid } from "./pages/landings/LivingGrid";
import { TerminalBoot } from "./pages/landings/TerminalBoot";
import { TheVoid } from "./pages/landings/TheVoid";
import { MonochromePrecision } from "./pages/landings/MonochromePrecision";
import { WarmMomentum } from "./pages/landings/WarmMomentum";
import { TerminalVerdict } from "./pages/landings/TerminalVerdict";
import { isPublishedHost } from "./lib/publishing";
import { getGitHubPagesBasename } from "./lib/github-pages";
import { OfflineDialog } from "@/components/ide/OfflineDialog";
import { InboxNotifier } from "@/components/ide/InboxNotifier";

const queryClient = new QueryClient();

const landingVariants = [
  "/landing",
  "/landing/living-grid",
  "/landing/terminal-boot",
  "/landing/the-void",
  "/landing/monochrome",
  "/landing/warm-momentum",
  "/landing/terminal-verdict",
] as const;

const getLandingVariant = () => {
  const roll = Math.random();
  if (roll < 0.99) return "/landing";
  const otherVariants = landingVariants.slice(1);
  const idx = Math.floor(Math.random() * otherVariants.length);
  return otherVariants[idx] ?? "/landing";
};

const RootRoute = () => {
  if (isPublishedHost()) return <Index />;
  const choice = getLandingVariant();
  if (choice === "/landing") return <Landing />;
  return <Navigate to={choice} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <OnboardingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineDialog />
          <InboxNotifier />
          <OnboardingManager />
          <DiscordProvider>
          <BrowserRouter basename={getGitHubPagesBasename()}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/landing/living-grid" element={<LivingGrid />} />
              <Route path="/landing/terminal-boot" element={<TerminalBoot />} />
              <Route path="/landing/the-void" element={<TheVoid />} />
              <Route path="/landing/monochrome" element={<MonochromePrecision />} />
              <Route path="/landing/warm-momentum" element={<WarmMomentum />} />
              <Route path="/landing/terminal-verdict" element={<TerminalVerdict />} />
              <Route path="/home" element={<Index />} />
              <Route path="/editor" element={<Index />} />
              <Route path="/project/:projectId" element={<Index />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-use" element={<TermsOfUsePage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/FTC" element={<FTCPage />} />
              <Route path="/ftc" element={<FTCPage />} />
              <Route path="/ardurino" element={<ArduinoPage />} />
              <Route path="/arduino" element={<ArduinoPage />} />
              <Route path="/office" element={<OfficePage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/scratch" element={<ScratchPage />} />
              <Route path="/cad" element={<CadPage />} />
              <Route path="/auth-bridge" element={<AuthBridge />} />
              <Route path="/auth-link" element={<AuthLink />} />
              <Route path="/auth-logout" element={<AuthLogout />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/link-discord" element={<LinkDiscord />} />
              <Route path="/admin/oauth-hosts" element={<OAuthHostsAdmin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </DiscordProvider>
        </TooltipProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
