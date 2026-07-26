import { useSyncExternalStore, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Store cấp module: 1 lời gọi beforeinstallprompt dùng chung cho mọi instance.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => deferred;

export function useInstallPrompt() {
  const evt = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    deferred = null; // prompt() chỉ dùng được 1 lần
    emit();
  }, []);
  return { canInstall: evt !== null, promptInstall };
}
