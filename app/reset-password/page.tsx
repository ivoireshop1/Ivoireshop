import { pageMetadata } from "@/src/lib/page-metadata";
import { PasswordRecoveryExperience } from "@/src/components/auth/password-recovery-experience";

export const metadata = pageMetadata("Reset Password", "Reset your account password.", "/reset-password", false);

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <PasswordRecoveryExperience invalid={params.error === "invalid"} stage={params.stage} />;
}
