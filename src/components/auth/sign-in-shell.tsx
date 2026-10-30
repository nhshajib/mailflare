"use client";

import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";
import styles from "./sign-in-shell.module.css";

export function SignInShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href="https://typewit.com/" className={styles.brand} aria-label="TypeWit home">
          <img src="/typewit-logo.png" alt="TypeWit" width={132} height={38} />
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.product}>Mail console</span>
        </a>
        <div className={styles.headerActions}>
          <a href="https://typewit.com/" className={styles.website}>Visit website <ArrowUpRight size={14} aria-hidden="true" /></a>
          <LanguageSelector variant="text" />
        </div>
      </header>
      <div className={styles.stage}>
        <section className={styles.card} aria-labelledby="signin-title">
          <div className={styles.eyebrow}><span className={styles.lock}><LockKeyhole size={16} aria-hidden="true" /></span> Administrator access</div>
          <h1 id="signin-title" className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
          <div className={styles.form}>{children}</div>
          {footer && <div className={styles.returnLink}>{footer}</div>}
          <p className={styles.accessNote}><LockKeyhole size={13} aria-hidden="true" /> Reserved for authorized TypeWit administrators.</p>
        </section>
      </div>
      <footer className={styles.footer}>
        <span>TypeWit Mail</span>
        <a href="https://github.com/nhshajib/mailflare" target="_blank" rel="noreferrer">Source code (AGPLv3)</a>
      </footer>
    </main>
  );
}
