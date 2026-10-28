"use client";

import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";
import { TYPEWIT_IDENTITY } from "@/lib/typewit/identity";

export function AuthShell({
  title,
  description,
  children,
  footer,
  steps,
}: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-[#f1f4fa] text-neutral-900 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-10">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-white px-6 py-8 sm:min-h-0 sm:rounded-3xl sm:px-10 sm:py-10 sm:shadow-xl">
        <header className="flex flex-col items-center text-center">
          <img
            src={TYPEWIT_IDENTITY.logoPath}
            alt={TYPEWIT_IDENTITY.shortName}
            className="h-auto w-auto max-w-[180px] object-contain sm:max-w-[195px]"
          />
          <h1 className="mt-6 text-3xl font-medium tracking-tight text-neutral-950 sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-sm text-sm leading-6 text-neutral-600">
              {description}
            </p>
          )}
        </header>

        <section className="mt-6 min-w-0 sm:mt-8">
          {steps && (
            <div className="mb-7 flex flex-wrap gap-2 text-xs font-semibold">
              {steps.map((step, index) => (
                <span key={step.label} className="flex items-center gap-2">
                  <span className={step.active ? "text-blue-700" : "text-neutral-500"}>
                    {index + 1} {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <span className="text-neutral-300">/</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="w-full">{children}</div>
          {footer && (
            <div className="mt-8 text-sm font-medium text-blue-700">{footer}</div>
          )}
        </section>

        <div className="mt-7 flex justify-center">
          <LanguageSelector variant="text" />
        </div>
      </main>
    </div>
  );
}
