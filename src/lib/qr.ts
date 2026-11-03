import QRCode from 'qrcode';

/** Deep lavender on white: pretty, and still far above the contrast phone cameras need. */
export const QR_DARK = '#352353';
const QR_LIGHT = '#FFFFFF';

// "H" = highest error correction, so a slightly scuffed or folded print still scans.
const base = { errorCorrectionLevel: 'H' as const, margin: 2, color: { dark: QR_DARK, light: QR_LIGHT } };

export const qrPng = (text: string, width: number): Promise<string> => QRCode.toDataURL(text, { ...base, width });
export const qrSvg = (text: string): Promise<string> => QRCode.toString(text, { ...base, type: 'svg' });

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Draws the wedding-themed QR card (portrait PNG) on a canvas. */
export async function renderQrCard(names: string, qrDataUrl: string): Promise<Blob> {
  const W = 1500;
  const H = 2100;
  await Promise.all([
    document.fonts.load('120px "Great Vibes"'),
    document.fonts.load('700 60px "Cormorant Garamond"'),
    document.fonts.load('800 50px Nunito'),
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the image.');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#EFE9F9');
  bg.addColorStop(0.55, '#FFFFFF');
  bg.addColorStop(1, '#FBF8F1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#C9A96E';
  ctx.lineWidth = 10;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.lineWidth = 3;
  ctx.strokeRect(90, 90, W - 180, H - 180);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4B3472';
  ctx.font = '700 84px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(names.toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 270);

  ctx.fillStyle = '#C9A96E';
  ctx.fillRect(W / 2 - 260, 330, 200, 4);
  ctx.fillRect(W / 2 + 60, 330, 200, 4);
  ctx.font = '48px Georgia, serif';
  ctx.fillText('♥', W / 2, 346);

  ctx.fillStyle = '#634693';
  ctx.font = '120px "Great Vibes", cursive';
  ctx.fillText('Help Us Capture', W / 2, 520);
  ctx.fillText('Our Beautiful Day!', W / 2, 660);

  const size = 880;
  const x = (W - size) / 2;
  const y = 760;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#C9A96E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(x - 40, y - 40, size + 80, size + 80, 40);
  ctx.fill();
  ctx.stroke();

  const img = new Image();
  img.src = qrDataUrl;
  await img.decode();
  ctx.drawImage(img, x, y, size, size);

  ctx.fillStyle = '#4B3472';
  ctx.font = '800 58px Nunito, system-ui, sans-serif';
  ctx.fillText('SCAN TO SHARE YOUR PHOTOS 📸', W / 2, 1830);
  ctx.fillStyle = '#8E713E';
  ctx.font = 'italic 600 56px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Your memories are part of our story.', W / 2, 1930);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'),
  );
}
