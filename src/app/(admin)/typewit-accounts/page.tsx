"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type Account = { id: string; email: string; name: string; role: string; disabled: boolean };
type Domain = { id: string; hostname: string; status: string };
type ApiError = { error?: unknown };
function errorText(data: ApiError, fallback: string) {
  return typeof data.error === "string" ? data.error : fallback;
}

export default function TypewitAccountsPage() {
  const viewer = useCurrentUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [usersResponse, domainsResponse] = await Promise.all([
      authFetch("/api/typewit/accounts"),
      authFetch("/api/domains"),
    ]);
    const usersData = await usersResponse.json() as { accounts?: Account[] } & ApiError;
    const domainsData = await domainsResponse.json() as { domains?: Domain[] } & ApiError;
    if (!usersResponse.ok) throw new Error(errorText(usersData, "Cannot load accounts"));
    if (!domainsResponse.ok) throw new Error(errorText(domainsData, "Cannot load domains"));
    setAccounts(usersData.accounts ?? []);
    const active = (domainsData.domains ?? []).filter((domain) => domain.status === "active");
    setDomains(active);
    setDomainId((previous) => active.some((domain) => domain.id === previous) ? previous : (active[0]?.id ?? ""));
  }

  useEffect(() => {
    if (!viewer?.isPrimaryAdmin) return;
    refresh().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Unable to load accounts"))
      .finally(() => setLoading(false));
  }, [viewer?.isPrimaryAdmin]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await authFetch("/api/typewit/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, username, name: name.trim() || undefined, password }),
      });
      const data = await response.json() as ApiError;
      if (!response.ok) throw new Error(errorText(data, "Account creation failed"));
      setUsername("");
      setName("");
      setPassword("");
      await refresh();
      setStatus("Account and personal mailbox created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account creation failed");
    } finally {
      setSaving(false);
    }
  }

  if (!viewer) return <p>Loading account access…</p>;
  if (!viewer.isPrimaryAdmin) return <p role="alert">Only the primary administrator can access TypeWit accounts.</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-900">TypeWit accounts</h1>
        <p className="mt-2 text-sm text-neutral-600">Create personal accounts with one mailbox per user. Shared inboxes and account deletion are not supported here.</p>
      </header>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add account</h2>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">Mailbox username
            <input className="mt-1 block w-full rounded-lg border p-2" autoComplete="off" required maxLength={64} pattern="[a-zA-Z0-9._%+\\-]+" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hello" />
          </label>
          <label className="block text-sm font-medium">Domain
            <select className="mt-1 block w-full rounded-lg border p-2" required value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.hostname}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Display name (optional)
            <input className="mt-1 block w-full rounded-lg border p-2" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Initial password (at least 12 characters)
            <input className="mt-1 block w-full rounded-lg border p-2" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={saving || !domainId} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Creating…" : "Create account"}</button>
        </form>
        {status && <p className="mt-4 text-sm" role="status">{status}</p>}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Accounts</h2>
        {loading ? <p className="mt-3 text-sm">Loading…</p> : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><strong>{account.name}</strong><span className="block text-neutral-600">{account.email}</span></span>
                <span className="text-neutral-500">{account.role}{account.disabled ? " · Disabled" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
