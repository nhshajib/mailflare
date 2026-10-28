"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth/client";

type Source = { id: string; localPart: string; hostname: string };
type Rule = { mailboxId: string; destination: string; enabled: boolean };
export function TypewitForwardingPanel() {
  const [mailboxId, setMailboxId] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["typewit-forwarding"], queryFn: async () => {
    const response = await authFetch("/api/typewit/forwarding");
    if (!response.ok) throw new Error("Forwarding rules are unavailable");
    return await response.json() as { sources: Source[]; rules: Rule[]; deliveryCounts: { mailboxId: string; state: string; count: number }[]; available: boolean };
  } });
  const sources = query.data?.sources ?? [];
  const rules = query.data?.rules ?? [];
  const deliveryCounts = query.data?.deliveryCounts ?? [];
  const available = query.data?.available ?? false;
  const selectedMailboxId = mailboxId || sources[0]?.id || "";
  async function save(rule: Rule) {
    if (busy) return; setBusy(true);
    try {
      const response = await authFetch("/api/typewit/forwarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save forwarding rule");
      await query.refetch(); setStatus("Forwarding rule saved. A local copy is always retained.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to save forwarding rule"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
    <h2 className="text-lg font-semibold">TypeWit forwarding</h2>
    <p className="text-sm text-neutral-600">Forward a personal address to an external destination verified in Cloudflare Email Routing. Local domains are excluded to prevent loops. Delivery failures keep the original mail in the inbox.</p>
    <form className="grid gap-4 sm:grid-cols-2" aria-busy={busy} onSubmit={event => { event.preventDefault(); void save({ mailboxId: selectedMailboxId, destination, enabled: true }); }}>
      <label className="block text-sm font-medium">Source mailbox
        <select required className="mt-1 block w-full rounded-lg border p-2" value={selectedMailboxId} onChange={event => setMailboxId(event.target.value)}>
          <option value="" disabled>Select an address</option>
          {sources.map(source => <option key={source.id} value={source.id}>{source.localPart}@{source.hostname}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Verified destination
        <input type="email" autoComplete="email" required maxLength={254} className="mt-1 block w-full rounded-lg border p-2" value={destination} onChange={event => setDestination(event.target.value)} />
      </label>
      <button type="submit" disabled={!available || busy || !selectedMailboxId} className="justify-self-start rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Enable forwarding"}</button>
    </form>
    <p role="status" className="text-sm text-neutral-600">{status || (query.isPending ? "Loading forwarding rules…" : query.error ? "Unable to load forwarding rules." : !available ? "Forwarding is disabled pending isolated delivery validation." : "")}</p>
    <ul className="divide-y">
      {rules.length === 0 && <li className="py-2 text-sm text-neutral-600">No forwarding rules configured.</li>}
      {rules.map(rule => <li key={rule.mailboxId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <span className="min-w-0 break-all">{sources.find(source => source.id === rule.mailboxId)?.localPart ?? "Mailbox"} → {rule.destination}<span className="block text-neutral-500">{rule.enabled ? "Enabled" : "Disabled"}</span><span className="block text-xs text-neutral-500">{deliveryCounts.filter(item => item.mailboxId === rule.mailboxId).map(item => `${item.count} ${item.state}`).join(" · ")}</span></span>
        {rule.enabled && <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void save({ ...rule, enabled: false })}>Disable forwarding</button>}
      </li>)}
    </ul>
  </section>;
}
