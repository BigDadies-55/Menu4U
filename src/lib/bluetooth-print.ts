// BLE Thermal Printer — ESC/POS over Web Bluetooth (UTF-8 + BiDi for Hebrew)

const PRINTER_PROFILES = [
  // ISSC Transparent UART — primary for Goojprt PT210 and similar
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  // Standard 18F0 — secondary for PT210
  { service: "000018f0-0000-1000-8000-00805f9b34fb", char: "00002af1-0000-1000-8000-00805f9b34fb" },
  // FF00 — other generic printers
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb" },
  // E7810A — Epson-style BLE
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", char: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

const CMD = {
  INIT:        [0x1b, 0x40],
  ALIGN_L:     [0x1b, 0x61, 0x00],
  ALIGN_C:     [0x1b, 0x61, 0x01],
  BOLD_ON:     [0x1b, 0x45, 0x01],
  BOLD_OFF:    [0x1b, 0x45, 0x00],
  SIZE_2X:     [0x1d, 0x21, 0x11],
  SIZE_NORMAL: [0x1d, 0x21, 0x00],
  CUT:         [0x1d, 0x56, 0x00],
  LF:          [0x0a],
};

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
  const CHUNK = 200;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    try { await char.writeValueWithoutResponse(slice); }
    catch { await char.writeValue(slice); }
    if (i + CHUNK < data.length) await new Promise(r => setTimeout(r, 30));
  }
}

// ── Bidirectional text — makes Hebrew print correctly on LTR thermal printers ──
// Splits text into Hebrew (RTL) and other (LTR) segments.
// Reverses the segment order and reverses each Hebrew segment individually.
// Numbers and prices always remain LTR.
function bidi(str: string): string {
  type Seg = { text: string; rtl: boolean };
  const segs: Seg[] = [];
  let cur = "";
  let curRtl = false;

  for (const ch of str) {
    const cp = ch.codePointAt(0) ?? 0;
    const isRtl = cp >= 0x05b0 && cp <= 0x05ea; // Hebrew block (letters + nikud)
    if (isRtl !== curRtl && cur.length > 0) {
      segs.push({ text: cur, rtl: curRtl });
      cur = "";
    }
    curRtl = isRtl;
    cur += ch;
  }
  if (cur) segs.push({ text: cur, rtl: curRtl });

  return segs
    .reverse()
    .map(s => s.rtl ? [...s.text].reverse().join("") : s.text)
    .join("");
}

// ── ESC/POS byte builder ──
class Doc {
  private buf: number[] = [];

  cmd(...cmds: number[][]) { cmds.forEach(c => this.buf.push(...c)); return this; }

  // UTF-8 — PT210 and modern BLE printers handle it natively
  text(str: string) {
    this.buf.push(...new TextEncoder().encode(str));
    return this;
  }

  line(str = "") { return this.text(str).cmd(CMD.LF); }

  // Pure Hebrew line (header etc.) — reversed for LTR printer
  hline(str: string) { return this.line(bidi(str)); }

  // Two-column row for receipt:
  //   value (price/number) → LEFT side   (reads correctly RTL)
  //   label (Hebrew text)  → RIGHT side  (reversed for LTR printer)
  // cols = printer character width (58mm printer ≈ 32 chars at normal font)
  row(label: string, value: string, cols = 32) {
    const processedLabel = bidi(label);
    const gap = Math.max(1, cols - processedLabel.length - value.length);
    return this.line(value + " ".repeat(gap) + processedLabel);
  }

  dashes(n = 32) { return this.line("-".repeat(n)); }

  build() { return new Uint8Array(this.buf); }
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

function buildDoc(data: PrintReceiptData): Uint8Array {
  const now = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const doc = new Doc();

  doc.cmd(CMD.INIT);

  // ── Header ──
  doc.cmd(CMD.ALIGN_C, CMD.BOLD_ON, CMD.SIZE_2X);
  doc.hline(data.restaurantName);
  doc.cmd(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
  doc.hline("חשבון");
  doc.cmd(CMD.ALIGN_L);
  doc.dashes();

  // ── Meta: value LEFT, label RIGHT ──
  doc.row(`תאריך:`, date + "  " + time);
  doc.row(`שולחן:`, `${data.tableNum}${data.orderNumber ? `  #${data.orderNumber}` : ""}`);
  doc.row(`מלצר:`,  `${data.waiterName}${data.coversCount ? `  ${data.coversCount} סועדים` : ""}`);
  doc.dashes();

  // ── Items ──
  for (const item of data.items) {
    const qty   = `${item.quantity}x`;
    const price = item.isComped ? bidi("מתנה") : `${(item.price * item.quantity).toFixed(2)}`;
    const name  = bidi(item.name.slice(0, 20));
    // Print: price LEFT, "qty name" RIGHT
    const label = name + " " + qty;
    const gap   = Math.max(1, 32 - label.length - price.length);
    doc.line(price + " ".repeat(gap) + label);
  }
  doc.dashes();

  // ── Totals ──
  doc.row('לפני מע"מ:', data.totalExVat.toFixed(2));
  doc.row('מע"מ 18%:',  data.vatAmount.toFixed(2));
  doc.dashes();
  doc.cmd(CMD.BOLD_ON);
  doc.row('סה"כ לתשלום:', data.totalInclVat.toFixed(2));
  doc.cmd(CMD.BOLD_OFF);
  doc.dashes();

  if (data.notes) doc.hline(`הערה: ${data.notes}`);

  // ── Footer ──
  doc.cmd(CMD.ALIGN_C);
  doc.hline("תודה על ביקורכם!");
  doc.hline("נשמח לראותכם שוב");
  doc.cmd(CMD.LF, CMD.LF, CMD.LF);
  doc.cmd(CMD.CUT);

  return doc.build();
}

export async function bluetoothPrint(data: PrintReceiptData, forceReconnect = false): Promise<void> {
  const char  = await getChar(forceReconnect);
  const bytes = buildDoc(data);
  await writeChunked(char, bytes);
}
