// BLE Thermal Printer — Canvas raster, RTL Hebrew
// PT210 is a Chinese GBK printer; bytes 0x80–0x9A are GBK lead bytes →
// black rectangles regardless of which ESC t code table we request.
// Solution: render OffscreenCanvas at 2× super-sampling (browser handles Hebrew
// RTL via ctx.direction = "rtl") then send as ESC/POS GS v 0 raster image.

const PRINTER_PROFILES = [
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  { service: "000018f0-0000-1000-8000-00805f9b34fb", char: "00002af1-0000-1000-8000-00805f9b34fb" },
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb" },
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", char: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

let cachedChar: BluetoothRemoteGATTCharacteristic | null = null;
let cachedDevice: BluetoothDevice | null = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function disconnectPrinter() {
  cachedDevice?.gatt?.disconnect();
  cachedChar = null;
  cachedDevice = null;
}

async function getChar(forceReconnect = false): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!forceReconnect && cachedDevice?.gatt?.connected && cachedChar) return cachedChar;

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_PROFILES.map(p => p.service),
  });

  cachedDevice = device;
  device.addEventListener("gattserverdisconnected", () => { cachedChar = null; });

  const server = await device.gatt!.connect();

  for (const { service, char } of PRINTER_PROFILES) {
    try {
      const svc = await server.getPrimaryService(service);
      const c   = await svc.getCharacteristic(char);
      cachedChar = c;
      return c;
    } catch { /* try next profile */ }
  }
  throw new Error("לא נמצא שירות הדפסה — בדוק שהמדפסת דולקת ובטווח");
}

async function writeChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    try { await char.writeValueWithoutResponse(slice); }
    catch { await char.writeValue(slice); }
    if (i + CHUNK < data.length) await new Promise(r => setTimeout(r, 30));
  }
}

// ── Canvas raster ─────────────────────────────────────────────────────────────
const DOTS = 384;    // printer width in dots (58 mm @ 203 dpi)
const SS   = 2;      // super-sample: render 2× then downsample for sharper text
const CW   = DOTS * SS;

// Fixed line heights — do NOT rely on actualBoundingBoxAscent (returns 0 when
// the font isn't loaded yet in OffscreenCanvas, causing all lines to overlap).
const NORM_PX  = 18 * SS;                       // font size, normal
const LARGE_PX = 28 * SS;                       // font size, header
const LINE_H   = Math.round(NORM_PX  * 1.7);   // normal line height
const LARGE_H  = Math.round(LARGE_PX * 1.5);   // header line height
const DASH_H   = Math.round(NORM_PX  * 0.9);   // thin separator height
const BLANK_H  = LINE_H;                        // blank = one full line
const MARGIN   = 8  * SS;

function fnt(px: number, bold: boolean) {
  return `${bold ? "bold " : ""}${px}px 'Arial Hebrew', Arial, sans-serif`;
}

// Baseline position within a line slot (fraction of line height)
const BASELINE = 0.76;

type Spec =
  | { t: "center"; text: string; large?: boolean; bold?: boolean }
  | { t: "row";    label: string; value: string;  bold?: boolean }
  | { t: "dash" }
  | { t: "blank" };

function specLineH(s: Spec): number {
  if (s.t === "dash")  return DASH_H;
  if (s.t === "blank") return BLANK_H;
  if (s.t === "center" && s.large) return LARGE_H;
  return LINE_H;
}

function buildSpec(data: PrintReceiptData): Spec[] {
  const now  = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const s: Spec[] = [
    { t: "blank" },
    { t: "center", text: data.restaurantName, large: true, bold: true },
    { t: "center", text: "חשבון", bold: true },
    { t: "blank" },
    { t: "dash" },
    { t: "row", label: "תאריך:", value: `${date}  ${time}` },
    { t: "row", label: "שולחן:", value: `${data.tableNum}${data.orderNumber ? `  #${data.orderNumber}` : ""}` },
  ];
  if (data.waiterName || data.coversCount) {
    s.push({ t: "row", label: "מלצר:", value: `${data.waiterName}${data.coversCount ? `  ${data.coversCount}` : ""}` });
  }
  s.push({ t: "dash" });
  s.push({ t: "blank" });

  for (const item of data.items) {
    const price = item.isComped ? "0.00" : (item.price * item.quantity).toFixed(2);
    const tag   = item.isComped ? " מתנה" : "";
    s.push({ t: "row", label: `${item.name.slice(0, 18)}${tag}`, value: `${price}  ${item.quantity}×` });
  }
  s.push({ t: "blank" });
  s.push({ t: "dash" });

  s.push({ t: "row", label: 'לפני מע"מ:', value: data.totalExVat.toFixed(2) });
  s.push({ t: "row", label: 'מע"מ 18%:',  value: data.vatAmount.toFixed(2)   });
  s.push({ t: "dash" });
  s.push({ t: "blank" });
  s.push({ t: "row", label: 'סה"כ לתשלום:', value: data.totalInclVat.toFixed(2), bold: true });
  s.push({ t: "blank" });
  s.push({ t: "dash" });

  if (data.notes) {
    s.push({ t: "blank" });
    s.push({ t: "center", text: `הערה: ${data.notes}` });
  }
  s.push({ t: "blank" });
  s.push({ t: "center", text: "תודה על ביקורכם!", bold: true });
  s.push({ t: "center", text: "נשמח לראותכם שוב" });
  s.push({ t: "blank" });

  return s;
}

async function buildDoc(data: PrintReceiptData): Promise<Uint8Array> {
  const spec = buildSpec(data);

  // Fixed heights — no font measurement needed
  const hh      = spec.map(specLineH);
  const totalPx = hh.reduce((a, b) => a + b, 0) + NORM_PX;
  const H       = Math.ceil(totalPx / SS) * SS;   // must be divisible by SS

  // ── Render ────────────────────────────────────────────────────────────────
  const canvas = new OffscreenCanvas(CW, H);
  const ctx    = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, CW, H);
  ctx.fillStyle = "black";

  let y = 0;

  for (let i = 0; i < spec.length; i++) {
    const s  = spec[i];
    const lh = hh[i];

    if (s.t === "blank") { y += lh; continue; }

    if (s.t === "dash") {
      const lineY = y + Math.round(lh * 0.5);
      ctx.fillRect(MARGIN, lineY, CW - MARGIN * 2, SS);
      y += lh;
      continue;
    }

    const baseline = y + Math.round(lh * BASELINE);

    if (s.t === "center") {
      const px = s.large ? LARGE_PX : NORM_PX;
      ctx.font      = fnt(px, s.bold ?? false);
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.fillText(s.text, CW / 2, baseline);
    }

    if (s.t === "row") {
      ctx.font = fnt(NORM_PX, s.bold ?? false);

      // Hebrew label — right edge, browser renders RTL naturally
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillText(s.label, CW - MARGIN, baseline);

      // Numeric value — left edge, LTR
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillText(s.value, MARGIN, baseline);
    }

    y += lh;
  }

  // ── Downsample SS×SS blocks → 1-bit bitmap ───────────────────────────────
  const imgData  = ctx.getImageData(0, 0, CW, H);
  const px4      = imgData.data;
  const outH     = H / SS;
  const rowBytes = Math.ceil(DOTS / 8);
  const bitmap   = new Uint8Array(rowBytes * outH);

  for (let row = 0; row < outH; row++) {
    for (let col = 0; col < DOTS; col++) {
      let sum = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const idx = ((row * SS + dy) * CW + col * SS + dx) * 4;
          sum += px4[idx];   // R channel (white=255, black=0)
        }
      }
      if (sum / (SS * SS) < 160) {
        bitmap[row * rowBytes + (col >> 3)] |= 0x80 >> (col & 7);
      }
    }
  }

  // ── Assemble ESC/POS ──────────────────────────────────────────────────────
  const xL = rowBytes & 0xFF;
  const xH = rowBytes >> 8;
  const yL = outH    & 0xFF;
  const yH = outH    >> 8;

  const header = new Uint8Array([0x1b, 0x40, 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const footer = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const out    = new Uint8Array(header.length + bitmap.length + footer.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  out.set(footer, header.length + bitmap.length);
  return out;
}

export interface PrintReceiptData {
  restaurantName: string;
  tableNum: string;
  orderNumber: number | null;
  waiterName: string;
  coversCount: number | null;
  items: { name: string; quantity: number; price: number; isComped: boolean }[];
  totalInclVat: number;
  vatAmount: number;
  totalExVat: number;
  notes?: string | null;
}

export async function bluetoothPrint(data: PrintReceiptData, forceReconnect = false): Promise<void> {
  const char  = await getChar(forceReconnect);
  const bytes = await buildDoc(data);
  await writeChunked(char, bytes);
}
