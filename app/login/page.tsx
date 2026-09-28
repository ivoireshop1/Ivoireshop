import { pageMetadata } from "@/src/lib/page-metadata";
import AuthForm from "@/src/components/auth/auth-form";

export const metadata = pageMetadata("Sign In", "Sign in to your Ivoire Shop account.", "/login", false);

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
