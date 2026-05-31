import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as { toDataURL: (url: string, opts?: object) => Promise<string> };

type FreeTable = {
  id: string; num: number; name: string;
  seats: number; status: string;
};
type Room = { id: string; name: string; tables: FreeTable[] };
type LayoutV2 = { version: 2; rooms: Room[] };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, layout, origin } = (await req.json()) as {
    restaurantId: string;
    layout: LayoutV2;
    origin: string;
  };

  if (!restaurantId || !layout?.rooms) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Menu4U";
  wb.created = new Date();

  const ws = wb.addWorksheet("שולחנות", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { key: "room",   width: 18 },
    { key: "num",    width: 10 },
    { key: "name",   width: 20 },
    { key: "seats",  width: 10 },
    { key: "link",   width: 42 },
    { key: "qr",     width: 14 },
  ];

  // Header row
  const headerRow = ws.addRow(["חדר", "מספר", "שם", "מקומות", "קישור", "QR"]);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 11, color: { argb: "FFD4A017" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0402" } };
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FFD4A017" } },
    };
  });

  const ROW_HEIGHT = 90;
  const QR_SIZE = 95; // px

  let rowIndex = 2; // after header

  for (const room of layout.rooms) {
    for (const table of room.tables) {
      const tableUrl =
        table.num > 0
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(String(table.num))}`
          : null;

      const row = ws.addRow({
        room: room.name,
        num: table.num,
        name: table.name || `שולחן ${table.num}`,
        seats: table.seats,
        link: tableUrl ?? "",
      });
      row.height = ROW_HEIGHT;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "center" : "right", readingOrder: "rtl", wrapText: true };
        cell.font = { size: 10 };
        if (colNumber % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F4E8" } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
          right:  { style: "thin", color: { argb: "FFDDDDDD" } },
        };
      });

      // Hyperlink on link cell (col 5)
      if (tableUrl) {
        const linkCell = row.getCell(5);
        linkCell.value = { text: tableUrl, hyperlink: tableUrl };
        linkCell.font = { size: 10, color: { argb: "FF1155CC" }, underline: true };
      }

      // QR code image (col 6)
      if (tableUrl) {
        try {
          const dataUrl = await QRCode.toDataURL(tableUrl, { width: QR_SIZE, margin: 1 });
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
          const imgId = wb.addImage({ base64, extension: "png" });
          ws.addImage(imgId, {
            tl: { col: 5, row: rowIndex - 1 },
            ext: { width: QR_SIZE, height: QR_SIZE },
          });
        } catch {
          // no image if QR fails
        }
      }

      rowIndex++;
    }
  }

  // Freeze header row
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, rightToLeft: true }];

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tables-${restaurantId}.xlsx"`,
    },
  });
}
