// BLE Thermal Printer — Canvas raster over Web Bluetooth
// ESC/POS font ROM has no Hebrew; canvas rendering does — we send pixels (GS v 0).

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
  const CHUNK = 180; // safe under typical BLE MTU (200-244 bytes minus header overhead)
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    try { await char.writeValueWithoutResponse(slice); }
    catch { await char.writeValue(slice); }
    if (i + CHUNK < data.length) await new Promise(r => setTimeout(r, 30));
  }
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

// ── Canvas raster receipt builder ─────────────────────────────────────────────
// Renders to an offscreen canvas (the browser's text engine handles Hebrew RTL),
// converts to 1-bit bitmap, wraps in ESC/POS GS v 0 raster image command.
function buildDoc(data: PrintReceiptData): Uint8Array {
  const DOTS_W  = 384;          // 58 mm paper at 203 dpi
  const BYTES_W = DOTS_W / 8;  // 48 bytes per row
  const M       = 8;            // horizontal margin (px)
  const LH      = 22;           // normal line height
  const LH_L    = 30;           // large line height
  const GAP     = 12;           // blank-gap height

  type Row =
    | { t: "line"; text: string; right?: string; bold?: boolean; large?: boolean; center?: boolean }
    | { t: "dash" }
    | { t: "gap"  };

  const now  = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const rows: Row[] = [];
  const add = (r: Row) => rows.push(r);

  add({ t: "line", text: data.restaurantName, large: true, bold: true, center: true });
  add({ t: "line", text: "חשבון", center: true });
  add({ t: "dash" });
  add({ t: "line", text: "תאריך:", right: `${date}  ${time}` });
  add({ t: "line", text: "שולחן:", right: `${data.tableNum}${data.orderNumber ? `  #${data.orderNumber}` : ""}` });
  if (data.waiterName || data.coversCount) {
    add({ t: "line", text: "מלצר:", right: `${data.waiterName}${data.coversCount ? `  ${data.coversCount} סועדים` : ""}` });
  }
  add({ t: "dash" });

  for (const item of data.items) {
    const price = item.isComped ? "מתנה" : `${(item.price * item.quantity).toFixed(2)}`;
    add({ t: "line", text: `${item.quantity}x ${item.name.slice(0, 18)}`, right: price });
  }
  add({ t: "dash" });

  add({ t: "line", text: 'לפני מע"מ:',    right: data.totalExVat.toFixed(2) });
  add({ t: "line", text: 'מע"מ 18%:',     right: data.vatAmount.toFixed(2) });
  add({ t: "dash" });
  add({ t: "line", text: 'סה"כ לתשלום:', right: data.totalInclVat.toFixed(2), bold: true });
  add({ t: "dash" });

  if (data.notes) add({ t: "line", text: `הערה: ${data.notes}` });

  add({ t: "gap" });
  add({ t: "line", text: "תודה על ביקורכם!", center: true });
  add({ t: "line", text: "נשמח לראותכם שוב", center: true });
  add({ t: "gap" }); add({ t: "gap" }); add({ t: "gap" });

  // ── Canvas height ──
  const H = rows.reduce((h, r) => {
    if (r.t === "dash" || r.t === "gap") return h + GAP;
    return h + ((r as { large?: boolean }).large ? LH_L : LH);
  }, 8);

  // ── Render ──
  const canvas = document.createElement("canvas");
  canvas.width  = DOTS_W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, DOTS_W, H);
  ctx.fillStyle   = "#000";
  ctx.strokeStyle = "#000";

  let y = 4;
  for (const row of rows) {
    if (row.t === "gap") { y += GAP; continue; }
    if (row.t === "dash") {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, y + 5);
      ctx.lineTo(DOTS_W - M, y + 5);
      ctx.stroke();
      ctx.restore();
      y += GAP;
      continue;
    }

    const sz     = row.large ? 20 : 14;
    const lh     = row.large ? LH_L : LH;
    const weight = (row.bold || row.large) ? "bold" : "normal";
    ctx.font = `${weight} ${sz}px sans-serif`;
    const base = y + sz + 2;

    if (row.center) {
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.fillText(row.text, DOTS_W / 2, base);
    } else if (row.right !== undefined) {
      // Hebrew label on the RIGHT, numeric value on the LEFT
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillText(row.text, DOTS_W - M, base);
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillText(row.right, M, base);
    } else {
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillText(row.text, DOTS_W - M, base);
    }

    y += lh;
  }

  // ── 1-bit conversion (dark pixel → printed dot) ──
  const px     = ctx.getImageData(0, 0, DOTS_W, H).data;
  const bitmap: number[] = [];
  for (let row = 0; row < H; row++) {
    for (let b = 0; b < BYTES_W; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const col = b * 8 + bit;
        const i   = (row * DOTS_W + col) * 4;
        if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 128) byte |= 0x80 >> bit;
      }
      bitmap.push(byte);
    }
  }

  // Sanity check — canvas must have rendered something
  if (!bitmap.some(b => b !== 0)) throw new Error("שגיאת canvas — טען מחדש את הדף ונסה שוב");

  // ── ESC/POS: INIT + GS v 0 raster image + feed + cut ──
  const header = [
    0x1b, 0x40,                              // ESC @ — init
    0x1d, 0x76, 0x30, 0x00,                 // GS v 0, m=0 (normal density)
    BYTES_W & 0xff, (BYTES_W >> 8) & 0xff,  // xL, xH — bytes per row
    H       & 0xff, (H       >> 8) & 0xff,  // yL, yH — number of rows
  ];
  const footer = [0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]; // feed + cut

  const out = new Uint8Array(header.length + bitmap.length + footer.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  out.set(footer, header.length + bitmap.length);
  return out;
}

export async function bluetoothPrint(data: PrintReceiptData, forceReconnect = false): Promise<void> {
  const char  = await getChar(forceReconnect);
  const bytes = buildDoc(data);
  await writeChunked(char, bytes);
}
