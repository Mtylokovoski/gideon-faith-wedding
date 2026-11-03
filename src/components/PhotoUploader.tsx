import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { ACCEPT_ATTR } from '../lib/constants';
import { validateImageFile } from '../lib/files';
import { cx } from '../lib/format';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/** Big, simple "choose photos" area (works by tap on phones, and drag-and-drop on computers). */
export default function PhotoUploader({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const handle = (list: FileList | File[] | null) => {
    if (!list) return;
    const ok: File[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      const err = validateImageFile(f);
      if (err) bad.push(`${f.name || 'Photo'}: ${err}`);
      else ok.push(f);
    }
    setProblems(bad);
    if (ok.length) onFiles(ok);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cx(
          'flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-5 py-8 text-center transition',
          dragging ? 'border-lavender-500 bg-lavender-100' : 'border-champagne-500 bg-white/70 hover:bg-white',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <ImagePlus className="h-10 w-10 text-lavender-600" aria-hidden />
        <span className="font-serif text-2xl font-semibold text-lavender-900">Choose photos from your phone</span>
        <span className="text-sm text-lavender-700">You can pick many pictures at once · JPEG, PNG or WebP</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
      {problems.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {problems.slice(0, 5).map((p) => (
            <li key={p}>{p}</li>
          ))}
          {problems.length > 5 && <li>…and {problems.length - 5} more.</li>}
        </ul>
      )}
    </div>
  );
}
