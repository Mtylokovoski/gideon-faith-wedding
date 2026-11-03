import type { CategoryId } from '../types';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'preparations', label: 'Wedding preparations' },
  { id: 'bride', label: 'Bride moments' },
  { id: 'groom', label: 'Groom moments' },
  { id: 'ceremony', label: 'Ceremony' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'reception', label: 'Reception' },
  { id: 'dancing', label: 'Dancing & celebrations' },
  { id: 'behind_the_scenes', label: 'Behind the scenes' },
  { id: 'other', label: 'Other memories' },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CategoryId, string>;

export const STORAGE_BUCKET = 'wedding-photos';

/** Photos picked from the phone may be big; we compress them before upload. */
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
export const MAX_QUEUE = 40;
export const MAX_CAPTION = 200;
export const MAX_GUEST_NAME = 60;

export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp';

export const CONSENT_TEXT =
  'By submitting your photographs, you agree to share them with Gideon and Faith and other people who have access to the wedding gallery.';
