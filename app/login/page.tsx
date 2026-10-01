import { pageMetadata } from "@/src/lib/page-metadata";
import AuthForm from "@/src/components/auth/auth-form";

export const metadata = pageMetadata("Sign In", "Sign in to your Ivoire Shop account.", "/login", false);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; next?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="login" initialError={params.error} resetSuccess={params.reset === "success"} />;
}
