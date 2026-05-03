import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Docs from "./pages/Docs";
import ProfilePage from "./pages/Profile";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsOfUsePage from "./pages/TermsOfUse";
import Compare from "./pages/Compare";
import { isPublishedHost } from "./lib/publishing";
import { OfflineDialog } from "@/components/ide/OfflineDialog";
import { InboxNotifier } from "@/components/ide/InboxNotifier";

const queryClient = new QueryClient();

const landingVariants = [
  "/landing",
  "/__mockup/preview/landing-hero/LivingGrid",
  "/__mockup/preview/landing-hero/TerminalBoot",
  "/__mockup/preview/landing-hero/TheVoid",
  "/__mockup/preview/landing-hero/MonochromePrecision",
  "/__mockup/preview/landing-hero/WarmMomentum",
  "/__mockup/preview/landing-hero/TerminalVerdict",
] as const;

const RootRoute = () => {
  if (isPublishedHost()) return <Index />;
  const choice = landingVariants[Math.floor(Math.random() * landingVariants.length)];
  if (choice === "/landing") return <Landing />;
  window.location.replace(choice);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineDialog />
          <InboxNotifier />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/home" element={<Index />} />
              <Route path="/editor" element={<Index />} />
              <Route path="/project/:projectId" element={<Index />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-use" element={<TermsOfUsePage />} />
              <Route path="/compare" element={<Compare />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
