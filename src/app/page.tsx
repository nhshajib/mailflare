import { LoginClient } from "./(auth)/login/login-client";
import { authPageMetadata } from "./(auth)/auth-metadata";

export const dynamic = "force-dynamic";
export const generateMetadata = () => authPageMetadata("auth.signIn");

export default function HomePage() {
  return <LoginClient />;
}
