import { useEffect, useState } from "react";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const EVENT_NAME = "show-offline-dialog";

export interface OfflineDialogDetail {
  title?: string;
  description?: string;
  /** Optional callback invoked when connectivity is restored or the user retries. */
  onRetry?: () => void | Promise<void>;
  /** Optional label for the retry button. */
  retryLabel?: string;
}

/** Dispatch from anywhere to show the offline dialog. */
export function showOfflineDialog(detail: OfflineDialogDetail = {}) {
  window.dispatchEvent(new CustomEvent<OfflineDialogDetail>(EVENT_NAME, { detail }));
}

export function OfflineDialog() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OfflineDialogDetail>({});
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OfflineDialogDetail>;
      setDetail(ce.detail || {});
      setOnline(navigator.onLine);
      setRetrying(false);
      setOpen(true);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Probe real connectivity (navigator.onLine can lie).
      let reachable = navigator.onLine;
      if (reachable) {
        try {
          await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
        } catch {
          reachable = false;
        }
      }
      if (!reachable) {
        setOnline(false);
        return;
      }
      setOnline(true);
      if (detail.onRetry) {
        await detail.onRetry();
      }
      setOpen(false);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-destructive" />
            {detail.title || "You're offline"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {detail.description ||
              "This action requires an internet connection. Please reconnect to Wi-Fi or your network and try again."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
            online
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              online ? "bg-success animate-pulse" : "bg-destructive"
            }`}
          />
          {online
            ? "Connection detected — click Reconnect to retry."
            : "No connection detected. We'll auto-retry once you're back online."}
        </div>

        <AlertDialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
          <Button onClick={handleRetry} disabled={retrying} className="gap-2">
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {detail.retryLabel || "Reconnect"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
