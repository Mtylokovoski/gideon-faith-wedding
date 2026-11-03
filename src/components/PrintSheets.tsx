import { FloralCorner } from './Decor';

interface Props {
  names: string;
  qr: string; // PNG data URL
}

const A4 = { width: '210mm', height: '297mm' } as const;

/** The printable A4 wedding sign. Sized in millimetres so it prints exactly one page. */
export function SignSheet({ names, qr }: Props) {
  return (
    <section
      style={{ ...A4, pageBreakAfter: 'always', breakAfter: 'page' }}
      className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-lavender-100 via-white to-ivory text-center text-lavender-900"
    >
      <div className="absolute inset-[8mm] rounded-[6mm] border-[0.8mm] border-champagne-500" aria-hidden />
      <div className="absolute inset-[11mm] rounded-[4mm] border-[0.3mm] border-champagne-400" aria-hidden />
      <FloralCorner className="absolute -left-[4mm] -top-[4mm] w-[46mm]" />
      <FloralCorner className="absolute -bottom-[4mm] -right-[4mm] w-[46mm] rotate-180" />

      <div className="relative flex flex-col items-center px-[24mm]">
        <p className="font-serif text-[22pt] font-bold uppercase tracking-[0.18em] text-lavender-800">{names}</p>
        <div className="my-[5mm] flex w-[70mm] items-center gap-[3mm]" aria-hidden>
          <span className="h-[0.3mm] flex-1 bg-champagne-500" />
          <span className="text-[14pt] text-champagne-500">♥</span>
          <span className="h-[0.3mm] flex-1 bg-champagne-500" />
        </div>
        <p className="font-script text-[44pt] leading-[1.1] text-lavender-700">Help Us Capture Our Beautiful Day!</p>

        <div className="mt-[9mm] rounded-[5mm] border-[0.6mm] border-champagne-500 bg-white p-[5mm] shadow-lg">
          <img src={qr} alt="QR code to the wedding photo booth" style={{ width: '104mm', height: '104mm' }} />
        </div>

        <p className="mt-[9mm] text-[20pt] font-extrabold tracking-[0.12em] text-lavender-800">SCAN TO SHARE YOUR PHOTOS 📸</p>
        <p className="mt-[4mm] font-serif text-[18pt] italic text-champagne-700">Your memories are part of our story.</p>
      </div>
    </section>
  );
}

/** One small table card (A6). */
export function TableCard({ names, qr }: Props) {
  return (
    <div
      style={{ width: '105mm', height: '148.5mm' }}
      className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-lavender-50 to-white text-center text-lavender-900"
    >
      <div className="absolute inset-[5mm] rounded-[3mm] border-[0.5mm] border-champagne-500" aria-hidden />
      <div className="relative flex flex-col items-center px-[10mm]">
        <p className="font-serif text-[12pt] font-bold uppercase tracking-[0.16em] text-lavender-800">{names}</p>
        <div className="my-[3mm] flex w-[34mm] items-center gap-[2mm]" aria-hidden>
          <span className="h-[0.25mm] flex-1 bg-champagne-500" />
          <span className="text-[9pt] text-champagne-500">♥</span>
          <span className="h-[0.25mm] flex-1 bg-champagne-500" />
        </div>
        <div className="rounded-[3mm] border-[0.4mm] border-champagne-400 bg-white p-[3mm]">
          <img src={qr} alt="QR code to the wedding photo booth" style={{ width: '58mm', height: '58mm' }} />
        </div>
        <p className="mt-[5mm] text-[11pt] font-extrabold tracking-[0.1em] text-lavender-800">SCAN TO SHARE YOUR PHOTOS 📸</p>
        <p className="mt-[2mm] font-serif text-[11pt] italic text-champagne-700">Your memories are part of our story.</p>
      </div>
    </div>
  );
}

/** A full A4 page holding four table cards, with thin cut lines. */
export function CardsSheet({ names, qr }: Props) {
  return (
    <section
      style={{ ...A4, pageBreakAfter: 'always', breakAfter: 'page' }}
      className="grid grid-cols-2 grid-rows-2 bg-white"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border border-dashed border-lavender-300">
          <TableCard names={names} qr={qr} />
        </div>
      ))}
    </section>
  );
}
