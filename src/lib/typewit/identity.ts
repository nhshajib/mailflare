/**
 * TypeWit-specific application identity.
 *
 * This configuration is independent of Mailflare's licensed branding service.
 * It does not modify license entitlements, account privileges, or mail delivery.
 * Presentation components may adopt these values incrementally.
 */
export const TYPEWIT_IDENTITY = {
  productName: "TypeWit Mail",
  shortName: "TypeWit",
  supportAddress: "support@typewit.com",
  applicationUrl: "https://mail.typewit.com",
  logoPath: "/typewit-logo.png",
  iconPath: "/icon.png",
} as const;

export function typewitPageTitle(section?: string): string {
  const name = TYPEWIT_IDENTITY.productName;
  return section?.trim() ? `${section.trim()} | ${name}` : name;
}
