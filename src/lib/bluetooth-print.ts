// BLE Thermal Printer — ESC/POS text mode, CP862 Hebrew encoding
// PT210 can't render Unicode Hebrew — uses CP862 (IBM-862, code table 13).
// Hebrew strings are reversed for RTL display on an LTR printer.

const PRINTER_PROFILES = [
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  { service: "000018f0-0000-1000-8000-00805f9b34fb", char: "00002af1-0000-1000-8000-00805f9b34fb" },
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb" },
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", char: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

const CMD = {
  INIT:     [0x1b, 0x40],
  CP862:    [0x1b, 0x74, 0x0d], // ESC t 13 — code table CP862 (Hebrew IBM)
  ALIGN_L:  [0x1b, 0x61, 0x00],
  ALIGN_C:  [0x1b, 0x61, 0x01],
  BOLD_ON:  [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  SIZE_2X:  [0x1d, 0x21, 0x11],
  SIZE_NRM: [0x1d, 0x21, 0x00],
  CUT:      [0x1d, 0x56, 0x00],
  LF:       [0x0a],
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
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    try { await char.writeValueWithoutResponse(slice); }
    catch { await char.writeValue(slice); }
    if (i + CHUNK < data.length) await new Promise(r => setTimeout(r, 30));
  }
}

// ── CP862 encoding ────────────────────────────────────────────────────────────
// Unicode Hebrew U+05D0–U+05EA → CP862 0x80–0x9A (single byte per letter).
// Printable ASCII passes through unchanged.
function cp862(ch: string): number | null {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x05D0 && cp <= 0x05EA) return cp - 0x05D0 + 0x80;
  if (cp > 0x1F && cp < 0x80)       return cp;   // plain ASCII
  return null;                                     // skip nikud, etc.
}

function encode(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) { const b = cp862(ch); if (b !== null) out.push(b); }
  return out;
}

// Hebrew is RTL; reverse entire string so the LTR printer produces RTL output.
function encodeRTL(str: string): number[] {
  return encode([...str].reverse().join(""));
}

// ── ESC/POS byte buffer ───────────────────────────────────────────────────────
class Doc {
  private buf: number[] = [];

  cmd(...cmds: number[][]) { cmds.forEach(c => this.buf.push(...c)); return this; }
  raw(bytes: number[])    { this.buf.push(...bytes); return this; }
  lf()                    { this.buf.push(0x0a); return this; }
  dashes(n = 32)          { return this.raw(Array(n).fill(0x2D)).lf(); }

  // Pure Hebrew line — reversed for LTR printer
  hline(str: string) { return this.raw(encodeRTL(str)).lf(); }

  // Two-column row: value (price/number) on LEFT, Hebrew label on RIGHT
  row(label: string, value: string, cols = 32) {
    const lb = encodeRTL(label);
    const vb = encode(value);
    const gap = Math.max(1, cols - lb.length - vb.length);
    return this.raw(vb).raw(Array(gap).fill(0x20)).raw(lb).lf();
  }

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
  const now  = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const doc  = new Doc();

  // Init + switch to Hebrew code page
  doc.cmd(CMD.INIT, CMD.CP862);

  // ── Header ──
  doc.cmd(CMD.ALIGN_C, CMD.BOLD_ON, CMD.SIZE_2X);
  doc.hline(data.restaurantName);
  doc.cmd(CMD.SIZE_NRM, CMD.BOLD_OFF);
  doc.hline("חשבון");
  doc.cmd(CMD.ALIGN_L);
  doc.dashes();

  // ── Meta ──
  doc.row("תאריך:", `${date}  ${time}`);
  doc.row("שולחן:", `${data.tableNum}${data.orderNumber ? `  #${data.orderNumber}` : ""}`);
  if (data.waiterName || data.coversCount) {
    doc.row("מלצר:", `${data.waiterName}${data.coversCount ? `  ${data.coversCount}` : ""}`);
  }
  doc.dashes();

  // ── Items: price+qty on left, name on right ──
  for (const item of data.items) {
    const price = item.isComped ? "0.00" : `${(item.price * item.quantity).toFixed(2)}`;
    const tag   = item.isComped ? " מתנה" : "";
    doc.row(`${item.name.slice(0, 14)}${tag}`, `${price}  ${item.quantity}x`);
  }
  doc.dashes();

  // ── Totals ──
  doc.row('לפני מע"מ:', data.totalExVat.toFixed(2));
  doc.row('מע"מ 18%:', data.vatAmount.toFixed(2));
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
