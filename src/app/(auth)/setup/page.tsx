import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SESSION_COOKIE, getUserFromSession } from "@/lib/auth/session";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getEnv } from "@/lib/cloudflare";
import { getPrimaryDomain } from "@/lib/user";
import { OnboardingClient } from "@/app/(auth)/onboarding/onboarding-client";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
	const env = getEnv();
	if (!(await hasAdminAccount(env))) redirect("/");

	const cookieStore = await cookies();
	const user = await getUserFromSession(env, cookieStore.get(SESSION_COOKIE)?.value);
	if (!user || user.disabled) redirect("/login");
	if (user.role !== "admin") redirect("/inbox");
	if (await getPrimaryDomain(env)) redirect("/inbox");

	return (
		<AuthGuard requireRole="admin">
			<OnboardingClient />
		</AuthGuard>
	);
}
