/** Production website address from config, falling back to the current origin. */
export function configuredSiteUrl(): string {
  const v = import.meta.env.VITE_SITE_URL?.trim();
  if (v) return v;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_WEDDING_SLUG?.trim() || 'gideon-faith';
