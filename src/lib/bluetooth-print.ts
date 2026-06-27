// BLE Thermal Printer — ESC/POS over Web Bluetooth
// Tested UUID sets for common generic BLE thermal printers (Aliexpress etc.)

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

// ESC/POS command bytes
const CMD = {
  INIT:         [0x1b, 0x40],
  ALIGN_L:      [0x1b, 0x61, 0x00],
  ALIGN_C:      [0x1b, 0x61, 0x01],
  BOLD_ON:      [0x1b, 0x45, 0x01],
  BOLD_OFF:     [0x1b, 0x45, 0x00],
  SIZE_2X:      [0x1d, 0x21, 0x11], // double width + height
  SIZE_NORMAL:  [0x1d, 0x21, 0x00],
  CUT:          [0x1d, 0x56, 0x00],
  LF:           [0x0a],
  // Hebrew code page (IBM 862) — works on most generic printers
  CP_HEBREW:    [0x1b, 0x74, 0x0f],
};

// Module-level cache — survives across prints in the same session
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

  // acceptAllDevices shows the full BLE scanner — many printers don't advertise
  // their service UUIDs so a services-filter would hide them from the picker.
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

// BLE MTU is small — chunk the data
async function writeChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 200;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    try {
      await char.writeValueWithoutResponse(slice);
    } catch {
      await char.writeValue(slice);
    }
    if (i + CHUNK < data.length) await new Promise(r => setTimeout(r, 30));
  }
}

// ── ESC/POS builder ──
class Doc {
  private buf: number[] = [];

  cmd(...cmds: number[][]) { cmds.forEach(c => this.buf.push(...c)); return this; }

  // Encode Hebrew via IBM-862 code page (bytes 0x80–0xFF = Hebrew chars)
  // For printers that support UTF-8, raw UTF-8 also works fine.
  text(str: string) {
    for (const ch of str) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp < 128) {
        this.buf.push(cp);
      } else if (cp >= 0x05d0 && cp <= 0x05ea) {
        // Alef–Tav mapped to IBM-862 range 0x80–0x9a
        this.buf.push(0x80 + (cp - 0x05d0));
      } else if (cp === 0x20aa) {
        this.buf.push(0xa4); // ₪ Shekel sign in IBM-862
      } else {
        this.buf.push(0x3f); // '?' fallback for unsupported chars
      }
    }
    return this;
  }

  line(str = "") { return this.text(str).cmd(CMD.LF); }

  // Right-pad / left-pad for 2-column receipt layout (total width = cols chars)
  row(left: string, right: string, cols = 32) {
    const gap = Math.max(1, cols - left.length - right.length);
    return this.line(left + " ".repeat(gap) + right);
  }

  dashes(n = 32) { return this.line("-".repeat(n)); }

  build() { return new Uint8Array(this.buf); }
}

// Hebrew text is stored logically (right-to-left visual), but ESC/POS prints
// left-to-right. We reverse Hebrew runs so they read correctly on paper.
function rtlLine(str: string): string {
  // Split by whitespace, reverse token order, reverse each Hebrew token
  const tokens = str.split(/(\s+)/);
  const reversed = tokens.map(tok =>
    /[א-ת₪]/.test(tok) ? [...tok].reverse().join("") : tok
  ).reverse();
  return reversed.join("");
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

  doc.cmd(CMD.INIT, CMD.CP_HEBREW);

  // ── Header ──
  doc.cmd(CMD.ALIGN_C, CMD.BOLD_ON, CMD.SIZE_2X);
  doc.line(rtlLine(data.restaurantName));
  doc.cmd(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
  doc.line(rtlLine("חשבון"));
  doc.cmd(CMD.ALIGN_L);
  doc.dashes();

  // ── Meta ──
  doc.row(rtlLine(`תאריך: ${date}`), time);
  doc.row(
    rtlLine(`שולחן: ${data.tableNum}`),
    data.orderNumber ? `#${data.orderNumber}` : ""
  );
  doc.row(
    rtlLine(`מלצר: ${data.waiterName}`),
    data.coversCount ? rtlLine(`סועדים: ${data.coversCount}`) : ""
  );
  doc.dashes();

  // ── Items ──
  for (const item of data.items) {
    const qty   = `${item.quantity}x`;
    const price = item.isComped ? rtlLine("מתנה") : `${(item.price * item.quantity).toFixed(2)}`;
    const name  = rtlLine(item.name.slice(0, 22));
    doc.row(`${qty} ${name}`, price);
  }
  doc.dashes();

  // ── Totals ──
  doc.row(rtlLine('לפני מע"מ:'), `${data.totalExVat.toFixed(2)}`);
  doc.row(rtlLine("מע\"מ 18%:"),  `${data.vatAmount.toFixed(2)}`);
  doc.dashes();
  doc.cmd(CMD.BOLD_ON);
  doc.row(rtlLine("סה\"כ לתשלום:"), `${data.totalInclVat.toFixed(2)}`);
  doc.cmd(CMD.BOLD_OFF);
  doc.dashes();

  if (data.notes) doc.line(rtlLine(`הערה: ${data.notes}`));

  // ── Footer ──
  doc.cmd(CMD.ALIGN_C);
  doc.line(rtlLine("תודה על ביקורכם!"));
  doc.line(rtlLine("נשמח לראותכם שוב"));
  doc.cmd(CMD.LF, CMD.LF, CMD.LF);
  doc.cmd(CMD.CUT);

  return doc.build();
}

export async function bluetoothPrint(data: PrintReceiptData, forceReconnect = false): Promise<void> {
  const char  = await getChar(forceReconnect);
  const bytes = buildDoc(data);
  await writeChunked(char, bytes);
}
