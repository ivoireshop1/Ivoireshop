import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";

export const ADMIN_HOME = "/admin";
export const CUSTOMER_HOME = "/account";

export function isAdminDestination(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

export function resolvePostLoginPath(role: string | null | undefined, requestedNext: string | null | undefined) {
  const requested = sanitizeReturnPath(requestedNext, "");
  const isAdmin = role === "admin";

  if (isAdmin) {
    if (requested && isAdminDestination(requested)) return requested;
    return ADMIN_HOME;
  }

  if (requested && isAdminDestination(requested)) return CUSTOMER_HOME;
  if (requested) return requested;
  return CUSTOMER_HOME;
}
