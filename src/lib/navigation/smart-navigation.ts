export type SmartBackButtonProps = {
  fallbackHref?: string;
  fallbackLabel?: string;
};

const DEFAULT_FALLBACK = "/shop";
const CURRENT_PATH_KEY = "ivoire.currentPath";
const PREVIOUS_PATH_KEY = "ivoire.previousPath";

export function sanitizeReturnPath(value: string | null | undefined, fallbackHref = DEFAULT_FALLBACK) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /^[a-z][a-z\d+.-]*:/i.test(value)) {
    return fallbackHref;
  }

  return value;
}

export function getBackButtonLabel(returnPath: string, fallbackLabel: string) {
  if (returnPath === "/shop") return "Back to Shop";
  const category = new URLSearchParams(returnPath.split("?")[1] ?? "").get("category");
  if (category && category !== "All Products") return `Back to ${category}`;
  if (returnPath.startsWith("/shop")) return "Back to Shop";
  return fallbackLabel;
}

export function buildProductPath(slug: string, returnPath?: string) {
  const path = `/product/${encodeURIComponent(slug)}`;
  return returnPath ? `${path}?returnTo=${encodeURIComponent(sanitizeReturnPath(returnPath))}` : path;
}

export function rememberNavigation(path: string) {
  if (typeof window === "undefined") return;

  const currentPath = sessionStorage.getItem(CURRENT_PATH_KEY);
  if (currentPath && currentPath !== path) {
    sessionStorage.setItem(PREVIOUS_PATH_KEY, currentPath);
  }
  sessionStorage.setItem(CURRENT_PATH_KEY, path);
}

export function getStoredPreviousPath(currentPath: string, fallbackHref = DEFAULT_FALLBACK) {
  if (typeof window === "undefined") return fallbackHref;

  const previousPath = sessionStorage.getItem(PREVIOUS_PATH_KEY);
  if (!previousPath || previousPath === currentPath) return fallbackHref;
  return sanitizeReturnPath(previousPath, fallbackHref);
}

export function hasUsableBrowserHistory() {
  if (typeof window === "undefined" || window.history.length < 2 || !document.referrer) return false;

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin;
  } catch {
    return false;
  }
}
