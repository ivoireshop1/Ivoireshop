import { pageMetadata } from "@/src/lib/page-metadata";
import AuthForm from "@/src/components/auth/auth-form";

export const metadata = pageMetadata("Update Password", "Choose a new account password.", "/update-password", false);

export default function UpdatePasswordPage() {
  return <AuthForm mode="update-password" />;
}
