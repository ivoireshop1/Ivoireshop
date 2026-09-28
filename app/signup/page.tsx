import { pageMetadata } from "@/src/lib/page-metadata";
import AuthForm from "@/src/components/auth/auth-form";

export const metadata = pageMetadata("Create Account", "Create your Ivoire Shop account.", "/signup", false);

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
