"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/components/branding-provider";
import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";

export function AuthShell({
  icon: Icon,
  title,
  description,
  children,
  footer,
  steps,
}: AuthShellProps) {
  const branding = useBranding();
  const [iconUrl, setIconUrl] = useState(branding.iconUrl);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconUrl(branding.iconUrl);
    setIconFailed(false);
  }, [branding.iconUrl]);

  return (
    <div className="min-h-dvh bg-[#f1f4fa] text-neutral-900 sm:px-6 sm:py-6 lg:flex lg:items-center lg:px-10 lg:py-10">
<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center overflow-hidden bg-white sm:min-h-0 sm:rounded-3xl sm:shadow-xl">        <section className="flex flex-col items-center p-7 pb-0 text-center sm:p-10 sm:pb-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center overflow-hidden">
              {iconFailed ? (
                <Icon className="h-8 w-8 text-blue-600" />
              ) : (
                <img
                  src={iconUrl}
                  onError={() => {
                    if (iconUrl !== "/icon-96.png") setIconUrl("/icon-96.png");
                    else setIconFailed(true);
                  }}
                  alt=""
                  className="h-8 w-8 object-contain"
                />
              )}
            </span>
            <span className="truncate text-md font-semibold text-neutral-800">
              TypeWit Mail
            </span>
          </div>

          <div className="mt-10 sm:mt-6 lg:mt-8">
            <h1 className="max-w-md text-3xl font-medium leading-tight tracking-tight text-neutral-950 sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-5 max-w-md text-base leading-7 text-neutral-600">
                {description}
              </p>
            )}
          </div>

          <div className="mt-auto hidden pt-8 lg:block">
            <LanguageSelector variant="text" />
          </div>
        </section>

        <section className="flex min-w-0 flex-col px-7 pb-10 pt-6 sm:px-10">
          {steps && (
            <div className="mb-7 flex flex-wrap gap-2 text-xs font-semibold">
              {steps.map((step, index) => (
                <span key={step.label} className="flex items-center gap-2">
                  <span
                    className={
                      step.active ? "text-blue-700" : "text-neutral-500"
                    }
                  >
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
            <div className="mt-8 text-sm font-medium text-blue-700">
              {footer}
            </div>
          )}
          <div className="mt-auto pt-8 lg:hidden">
            <LanguageSelector variant="text" />
          </div>
        </section>
      </main>
    </div>
  );
}
