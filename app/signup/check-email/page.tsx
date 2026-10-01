import { pageMetadata } from "@/src/lib/page-metadata";
import { CheckEmailExperience } from "@/src/components/auth/check-email-experience";

export const metadata = pageMetadata(
  "Check your email",
  "Confirm your Ivoire Shop account from the email we just sent.",
  "/signup/check-email",
  false,
);

export default function CheckEmailPage() {
  return <CheckEmailExperience />;
}
