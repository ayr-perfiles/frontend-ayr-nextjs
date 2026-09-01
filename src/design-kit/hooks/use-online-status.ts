import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

/**
 * The server cannot know the client's connectivity; assuming "online" keeps the
 * markup identical to the first client render, so nothing flashes on hydration.
 */
function getServerSnapshot() {
  return true;
}

/**
 * `navigator.onLine` is only a link-layer signal: `true` means "attached to a
 * network", not "the server is reachable". Good enough to warn the user, never
 * good enough to skip a request.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
