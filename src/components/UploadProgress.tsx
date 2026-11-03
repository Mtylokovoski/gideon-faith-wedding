import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { PendingUpload } from '../types';
import { CATEGORIES, MAX_CAPTION } from '../lib/constants';
import type { CategoryId } from '../types';

interface Props {
  items: PendingUpload[];
  disabled: boolean;
  onChange: (id: string, patch: Partial<PendingUpload>) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const stageLabel: Record<PendingUpload['status'], string> = {
  ready: 'Ready to share',
  processing: 'Getting your photo ready…',
  uploading: 'Sharing…',
  done: 'Shared — thank you!',
  error: 'Not shared yet',
};

/** One card per photo: preview, caption, category, progress bar, retry / remove. */
export default function UploadProgress({ items, disabled, onChange, onRemove, onRetry }: Props) {
  return (
    <ul className="space-y-4">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const editable = item.status === 'ready' || item.status === 'error';
          const working = item.status === 'processing' || item.status === 'uploading';
          return (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card overflow-hidden p-3"
            >
              <div className="flex gap-3">
                <img src={item.previewUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`flex items-center gap-1.5 text-sm font-bold ${
                        item.status === 'done'
                          ? 'text-green-700'
                          : item.status === 'error'
                            ? 'text-red-700'
                            : 'text-lavender-700'
                      }`}
                    >
                      {item.status === 'done' && <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      {item.status === 'error' && <AlertTriangle className="h-4 w-4" aria-hidden />}
                      {working && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      {stageLabel[item.status]}
                    </p>
                    {!working && item.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        disabled={disabled}
                        aria-label="Remove this photo"
                        className="-mr-1 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-lavender-600 hover:bg-lavender-100 disabled:opacity-40"
                      >
                        <Trash2 className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                  </div>

                  <input
                    value={item.caption}
                    onChange={(e) => onChange(item.id, { caption: e.target.value })}
                    disabled={!editable || disabled}
                    maxLength={MAX_CAPTION}
                    placeholder="Add a caption (optional)"
                    aria-label="Caption"
                    className="input mt-1 !min-h-[44px] text-sm disabled:opacity-60"
                  />
                  <select
                    value={item.category}
                    onChange={(e) => onChange(item.id, { category: e.target.value as CategoryId })}
                    disabled={!editable || disabled}
                    aria-label="Category"
                    className="input mt-2 !min-h-[44px] text-sm disabled:opacity-60"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(working || item.status === 'done') && (
                <div
                  className="mt-3 h-2.5 overflow-hidden rounded-full bg-lavender-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${item.status === 'done' ? 'bg-green-500' : 'bg-gradient-to-r from-lavender-400 to-champagne-500'}`}
                    style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                  />
                </div>
              )}

              {item.status === 'error' && (
                <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                  <p>{item.error ?? 'This photo could not be shared.'}</p>
                  <button type="button" onClick={() => onRetry(item.id)} disabled={disabled} className="btn-outline btn-sm mt-2 !border-red-300 !text-red-700">
                    <RefreshCw className="h-4 w-4" aria-hidden /> Try again
                  </button>
                </div>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
