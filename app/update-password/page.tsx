import { pageMetadata } from "@/src/lib/page-metadata";
import { PasswordRecoveryExperience } from "@/src/components/auth/password-recovery-experience";

export const metadata = pageMetadata("Update Password", "Choose a new account password.", "/update-password", false);

export default function UpdatePasswordPage() {
  return <PasswordRecoveryExperience />;
}
