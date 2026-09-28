import { ADMIN_HOME, CUSTOMER_HOME } from "@/src/lib/auth/post-login";

export type NavRole = "guest" | "customer" | "admin";

export function resolveHomeHref(role: NavRole) {
  if (role === "customer") return CUSTOMER_HOME;
  if (role === "admin") return ADMIN_HOME;
  return "/";
}

export function resolveStorefrontHomeHref(role: NavRole) {
  if (role === "customer") return CUSTOMER_HOME;
  return "/";
}
