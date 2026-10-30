"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";

export function SignInShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col bg-[#f5f7fb] text-[#14213b]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-linear-to-b from-[#e8efff] to-transparent" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
        <a href="https://typewit.com/" className="inline-flex items-center gap-2 rounded-md text-xs font-medium text-slate-600 transition-colors hover:text-[#0e55d3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> typewit.com
        </a>
        <LanguageSelector variant="text" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-5 sm:px-8">
        <div className="mb-7 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <LockKeyhole className="h-3.5 w-3.5 text-[#0e55d3]" aria-hidden="true" /> Mail administration
        </div>
        <section className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#dde4f0] bg-white px-6 py-9 shadow-[0_16px_60px_-24px_rgba(22,52,110,0.25)] sm:px-10 sm:py-10">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[#0e55d3]" />
          <img src="/typewit-logo.png" alt="TypeWit" width={174} height={50} className="mb-9 h-auto w-[174px]" />
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
          <div className="mt-7 [&_input]:h-12 [&_input]:rounded-lg [&_input]:border-slate-200 [&_input]:bg-white [&_input]:shadow-none [&_input:focus-visible]:border-[#0e55d3] [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-blue-100 [&_label]:text-xs [&_label]:font-medium">{children}</div>
          <p className="mt-7 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">Access is restricted to authorized administrators.</p>
        </section>
        <footer className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
          <span>TypeWit Mail</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <a href="https://github.com/nhshajib/mailflare" target="_blank" rel="noreferrer" className="rounded-sm underline decoration-slate-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Source code (AGPLv3)</a>
        </footer>
      </div>
    </main>
  );
}
