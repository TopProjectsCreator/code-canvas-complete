type InboxEventName = 'inbox:read-changed' | 'inbox:messages-changed';

export const inboxEvents = {
  emit(name: InboxEventName, detail?: unknown) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  },
  on(name: InboxEventName, handler: (e: CustomEvent) => void) {
    if (typeof window === 'undefined') return () => {};
    const wrapped = (e: Event) => handler(e as CustomEvent);
    window.addEventListener(name, wrapped);
    return () => window.removeEventListener(name, wrapped);
  },
};
