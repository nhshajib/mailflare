"use client";

import { ArrowUpRight, Mail, LockKeyhole } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";

export function SignInShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-[#f8f7f3] p-4 text-[#142c31] sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1600px] overflow-hidden rounded-[28px] border border-[#142c31]/10 bg-white sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.05fr_1fr] lg:min-h-[calc(100dvh-4rem)]">
        <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-[#142c31] p-12 text-[#f8f7f3] lg:flex xl:p-16">
          <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20"><Mail className="h-5 w-5" aria-hidden="true" /></span>
            TypeWit <span className="font-normal text-white/50">/ Mail</span>
          </div>
          <div className="relative py-16">
            <p className="mb-7 text-xs font-medium uppercase tracking-[0.25em] text-[#b9d6cb]">Your workspace, thoughtfully connected</p>
            <h2 className="max-w-lg font-serif text-6xl leading-[1.08] tracking-tight xl:text-7xl">Good conversations.<br /><span className="text-[#b9d6cb]">Great possibilities.</span></h2>
            <p className="mt-8 max-w-xs text-base leading-7 text-white/65">A considered space for your mail, your team, and everything that comes next.</p>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-white/15 pt-6">
            <p className="text-xs tracking-wide text-white/50">TypeWit Mail</p>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20"><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></span>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-44 -z-10 h-[560px] w-[560px] rounded-full border border-[#b9d6cb]/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-80 -left-40 -z-10 h-[640px] w-[640px] rounded-full border-[80px] border-[#b9d6cb]/5" />
        </aside>
        <section className="flex min-w-0 flex-col px-6 py-7 sm:px-12 sm:py-9 xl:px-20">
          <header className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-5 w-5" aria-hidden="true" /> TypeWit Mail</span>
            <LanguageSelector variant="text" />
          </header>
          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-14 sm:py-20">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3ef]"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></div>
            <h1 className="text-4xl font-medium leading-tight tracking-tight sm:text-[44px]">{title}</h1>
            {description && <p className="mt-3 text-sm leading-6 text-neutral-500">{description}</p>}
            <div className="mt-9 [&_input]:h-12 [&_input]:rounded-xl [&_input]:bg-[#fafbf9] [&_input]:shadow-none [&_input:focus-visible]:border-[#40635a] [&_label]:text-xs [&_label]:font-medium">{children}</div>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-6 text-[11px] text-neutral-500">
            <span>TypeWit Mail · Private workspace</span>
            <a href="https://github.com/nhshajib/mailflare" target="_blank" rel="noreferrer" className="underline decoration-neutral-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#142c31]">Source code (AGPLv3)</a>
          </footer>
        </section>
      </div>
    </main>
  );
}
