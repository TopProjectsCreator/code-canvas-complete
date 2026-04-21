import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EVENT_NAME = "show-offline-dialog";

export interface OfflineDialogDetail {
  title?: string;
  description?: string;
}

/** Dispatch from anywhere to show the offline dialog. */
export function showOfflineDialog(detail: OfflineDialogDetail = {}) {
  window.dispatchEvent(new CustomEvent<OfflineDialogDetail>(EVENT_NAME, { detail }));
}

export function OfflineDialog() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OfflineDialogDetail>({});

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OfflineDialogDetail>;
      setDetail(ce.detail || {});
      setOpen(true);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

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
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setOpen(false)}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
