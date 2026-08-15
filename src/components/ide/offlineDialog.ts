export const EVENT_NAME = "show-offline-dialog";

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