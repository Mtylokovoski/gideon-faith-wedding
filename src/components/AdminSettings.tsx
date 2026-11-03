import { useState } from 'react';
import { cx, errorMessage } from '../lib/format';
import { updateWedding } from '../services/adminService';
import ConfirmDialog from './ConfirmDialog';
import type { Wedding } from '../types';

interface Props {
  wedding: Wedding;
  onWeddingChange: (w: Wedding) => void;
  notify: (kind: 'ok' | 'err', text: string) => void;
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-9 w-16 shrink-0 rounded-full transition disabled:opacity-50',
        checked ? 'bg-lavender-600' : 'bg-lavender-200',
      )}
    >
      <span
        className={cx('absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all', checked ? 'left-8' : 'left-1')}
        aria-hidden
      />
    </button>
  );
}

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-lavender-700">{help}</p>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettings({ wedding, onWeddingChange, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  async function save(patch: Parameters<typeof updateWedding>[1], message: string) {
    setBusy(true);
    try {
      onWeddingChange(await updateWedding(wedding.id, patch));
      notify('ok', message);
      setConfirmClose(false);
    } catch (e) {
      notify('err', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card divide-y divide-champagne-300/50 px-5 sm:px-6">
      <Row
        title="Guests can upload photos"
        help={
          wedding.upload_enabled
            ? 'Switch this off after the wedding. The gallery stays open and every photo is kept.'
            : 'Uploads are closed. Guests see a thank-you message, and the gallery is still available.'
        }
      >
        <Switch
          label="Guests can upload photos"
          checked={wedding.upload_enabled}
          disabled={busy}
          onChange={(v) =>
            v
              ? void save({ upload_enabled: true }, 'Uploads are open again.')
              : setConfirmClose(true)
          }
        />
      </Row>

      <Row
        title="Show new photos straight away"
        help={
          wedding.auto_approve
            ? 'New photos appear in the gallery immediately. You can still reject or delete any of them.'
            : 'New photos wait in “Pending” until you approve them.'
        }
      >
        <Switch
          label="Show new photos straight away"
          checked={wedding.auto_approve}
          disabled={busy}
          onChange={(v) =>
            void save({ auto_approve: v }, v ? 'New photos will now appear straight away.' : 'New photos will now wait for your approval.')
          }
        />
      </Row>

      <Row
        title="Show the gallery button on the guest page"
        help={
          wedding.booth_shows_gallery
            ? 'Everyone who scans the QR code can open the gallery.'
            : 'The gallery link stays private. Only people you send it to can open it.'
        }
      >
        <Switch
          label="Show the gallery button on the guest page"
          checked={wedding.booth_shows_gallery}
          disabled={busy}
          onChange={(v) =>
            void save(
              { booth_shows_gallery: v },
              v ? 'The gallery button is now shown to guests.' : 'The gallery button is now hidden from guests.',
            )
          }
        />
      </Row>

      <div className="py-4">
        <label htmlFor="wedding-date" className="font-bold">
          Wedding date
        </label>
        <input
          id="wedding-date"
          type="date"
          className="input mt-2 max-w-xs"
          defaultValue={wedding.wedding_date ?? ''}
          disabled={busy}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== wedding.wedding_date) void save({ wedding_date: v }, 'Wedding date saved.');
          }}
        />
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Close photo uploads?"
          body="Guests will no longer be able to add photos. The gallery and all existing photos stay available. You can open uploads again at any time."
          confirmLabel="Close uploads"
          busy={busy}
          onConfirm={() => void save({ upload_enabled: false }, 'Uploads are now closed. The gallery is still available.')}
          onCancel={() => !busy && setConfirmClose(false)}
        />
      )}
    </div>
  );
}
