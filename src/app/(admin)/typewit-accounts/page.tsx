"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth/client";
import { TypewitForwardingPanel } from "@/components/typewit-forwarding-panel";
import { useCurrentUser } from "@/hooks/use-current-user";

type Account = { id: string; email: string; name: string; role: string; disabled: boolean; provisioningState: string | null };
type Domain = { id: string; hostname: string; status: string };
type ApiError = { error?: unknown };
function errorText(data: ApiError, fallback: string) {
  return typeof data.error === "string" ? data.error : fallback;
}

export default function TypewitAccountsPage() {
  const viewer = useCurrentUser();
  const [domainId, setDomainId] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAccounts() {
    const [usersResponse, domainsResponse] = await Promise.all([
      authFetch("/api/typewit/accounts"),
      authFetch("/api/domains"),
    ]);
    const usersData = await usersResponse.json() as { accounts?: Account[]; nextCursor?: string } & ApiError;
    const domainsData = await domainsResponse.json() as { domains?: Domain[] } & ApiError;
    if (!usersResponse.ok) throw new Error(errorText(usersData, "Cannot load accounts"));
    if (!domainsResponse.ok) throw new Error(errorText(domainsData, "Cannot load domains"));
    const allAccounts = usersData.accounts ?? [];
    let cursor = usersData.nextCursor;
    while (cursor) {
      const response = await authFetch(`/api/typewit/accounts?after=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error("Cannot load the remaining accounts");
      const page = await response.json() as { accounts: Account[]; nextCursor?: string };
      allAccounts.push(...page.accounts);
      cursor = page.nextCursor;
    }
    const active = (domainsData.domains ?? []).filter((domain) => domain.status === "active");
    return { accounts: allAccounts, domains: active };
  }
  const query = useQuery({ queryKey: ["typewit-accounts"], queryFn: loadAccounts, enabled: !!viewer?.isPrimaryAdmin });
  const accounts = query.data?.accounts ?? [];
  const domains = query.data?.domains ?? [];
  const loading = query.isPending;
  const selectedDomainId = domains.some(domain => domain.id === domainId) ? domainId : domains[0]?.id ?? "";
  async function refresh() { const result = await query.refetch(); if (result.error) throw result.error; }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await authFetch("/api/typewit/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: selectedDomainId, username, name: name.trim() || undefined, password }),
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
        <p className="mt-2 text-sm text-neutral-600">Create personal accounts with one mailbox per user. Manage account access and personal mailboxes. Forwarding always keeps a local copy.</p>
      </header>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add account</h2>
        <form className="mt-4 space-y-4" onSubmit={submit} aria-busy={saving}>
          <label className="block text-sm font-medium">Mailbox username
            <input className="mt-1 block w-full rounded-lg border p-2" autoComplete="off" required maxLength={64} aria-describedby="username-help" pattern="[A-Za-z0-9_%\-]+" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hello" />
          </label>
          <p id="username-help" className="text-xs text-neutral-600">Use letters, numbers, underscores, percent signs or hyphens. Dots and plus tags resolve to the same mailbox and cannot define a separate account.</p>
          <label className="block text-sm font-medium">Domain
            <select className="mt-1 block w-full rounded-lg border p-2" required value={selectedDomainId} onChange={(e) => setDomainId(e.target.value)}>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.hostname}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Display name (optional)
            <input className="mt-1 block w-full rounded-lg border p-2" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Initial password (at least 12 characters, at most 72 UTF-8 bytes)
            <input className="mt-1 block w-full rounded-lg border p-2" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {!loading && domains.length === 0 && <p role="status" className="text-sm text-neutral-600">No active domains are available. Configure a test domain before creating accounts.</p>}
          <button type="submit" disabled={saving || !selectedDomainId} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Creating…" : "Create account"}</button>
        </form>
        {(status || query.error) && <p className="mt-4 text-sm" role="status">{status || "Unable to load accounts. Try again shortly."}</p>}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Accounts</h2>
        {loading ? <p className="mt-3 text-sm">Loading…</p> : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {accounts.length === 0 && <li className="py-3 text-sm text-neutral-600">No accounts to display.</li>}
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0 break-all"><strong>{account.name}</strong><span className="block text-neutral-600">{account.email}</span></span>
                <span className="text-neutral-500">{account.role}{account.disabled ? " · Disabled" : " · Active"}{account.provisioningState && account.provisioningState !== "ready" ? " · Needs review" : ""}</span>
                {account.provisioningState && account.role === "user" && <button type="button" disabled={saving || (account.disabled && account.provisioningState !== "ready")} className="rounded-lg border px-3 py-2 disabled:opacity-50" aria-label={`${account.disabled ? "Enable" : "Disable"} ${account.email}`} onClick={async () => {
                  setSaving(true); setStatus("");
                  try {
                    const response = await authFetch("/api/typewit/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account.id, disabled: !account.disabled }) });
                    if (!response.ok) throw new Error(errorText(await response.json(), "Status change failed"));
                    await refresh(); setStatus("Account status updated.");
                  } catch (error) { setStatus(error instanceof Error ? error.message : "Status change failed"); }
                  finally { setSaving(false); }
                }}>{account.disabled ? "Enable" : "Disable"}</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <TypewitForwardingPanel />
    </div>
  );
}
