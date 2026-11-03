export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type CategoryId =
  | 'preparations'
  | 'bride'
  | 'groom'
  | 'ceremony'
  | 'family'
  | 'friends'
  | 'reception'
  | 'dancing'
  | 'behind_the_scenes'
  | 'other';

/** What the guest booth page may know (returned by the get_public_wedding RPC). */
export interface PublicWedding {
  bride_name: string;
  groom_name: string;
  wedding_date: string | null;
  upload_enabled: boolean;
  photo_count: number;
  gallery_token: string | null;
}

/** Full wedding row — administrators only. */
export interface Wedding {
  id: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string | null;
  wedding_slug: string;
  gallery_token: string;
  upload_enabled: boolean;
  auto_approve: boolean;
  booth_shows_gallery: boolean;
  created_at: string;
}

export interface GalleryWedding {
  bride_name: string;
  groom_name: string;
  wedding_date: string | null;
  wedding_slug: string;
  upload_enabled: boolean;
}

export interface GalleryPhoto {
  id: string;
  caption: string | null;
  category: CategoryId;
  guest_name: string | null;
  uploaded_at: string;
  width: number | null;
  height: number | null;
  url: string;
  thumb_url: string;
}

export interface GalleryResponse {
  wedding: GalleryWedding;
  photos: GalleryPhoto[];
  hasMore: boolean;
  total: number;
}

export interface GalleryEvent {
  photo_id: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  status: ApprovalStatus | null;
  finalized: boolean;
}

export interface PhotoRow {
  id: string;
  wedding_id: string;
  storage_path: string;
  thumb_path: string;
  caption: string | null;
  category: CategoryId;
  guest_name: string | null;
  approval_status: ApprovalStatus;
  uploaded_at: string;
  finalized: boolean;
  size_bytes: number;
  width: number | null;
  height: number | null;
}

export interface AdminPhoto extends PhotoRow {
  url?: string;
  thumbUrl?: string;
}

export interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  bytes: number;
}

/** Minimal shape the full-screen viewer needs (guest and admin photos both fit). */
export interface ViewerPhoto {
  id: string;
  url: string;
  caption: string | null;
  category: CategoryId;
  uploaded_at: string;
}

export type UploadStatus = 'ready' | 'processing' | 'uploading' | 'done' | 'error';

export interface PendingUpload {
  id: string;
  blob: Blob;
  previewUrl: string;
  name: string;
  source: 'camera' | 'file';
  caption: string;
  category: CategoryId;
  status: UploadStatus;
  progress: number;
  error?: string;
}
