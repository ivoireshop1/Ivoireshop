import { pageMetadata } from "@/src/lib/page-metadata";
import AuthForm from "@/src/components/auth/auth-form";

export const metadata = pageMetadata("Reset Password", "Reset your account password.", "/reset-password", false);

export default function ResetPasswordPage() {
  return <AuthForm mode="reset" />;
}
