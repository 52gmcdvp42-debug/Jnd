import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { formatDate } from "@/lib/format";

const NAVY = rgb(16 / 255, 24 / 255, 39 / 255);
const ELECTRIC = rgb(8 / 255, 123 / 255, 255 / 255);
const SNOW = rgb(244 / 255, 246 / 255, 250 / 255);
const SILVER = rgb(146 / 255, 155 / 255, 170 / 255);

/** Las fuentes estándar de PDF usan WinAnsi: se eliminan caracteres no representables. */
function clean(s: string) {
  return s.replace(/[^\x20-\x7E -ÿ€]/g, "");
}

export async function renderCertificatePdf(c: {
  code: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  verifyUrl: string;
  signerName?: string;
  signerTitle?: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado JND ${c.code}`);
  pdf.setAuthor("JND");
  const page = pdf.addPage([842, 595]); // A4 horizontal
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 0, width, height, color: NAVY });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: ELECTRIC, borderWidth: 1.5 });
  page.drawRectangle({ x: 24, y: height - 30, width: width - 48, height: 6, color: ELECTRIC });

  const center = (text: string, y: number, size: number, font = regular, color = SNOW) => {
    const t = clean(text);
    let s = size;
    while (font.widthOfTextAtSize(t, s) > width - 140 && s > 10) s -= 1;
    page.drawText(t, { x: (width - font.widthOfTextAtSize(t, s)) / 2, y, size: s, font, color });
  };

  center("JND", height - 110, 46, bold);
  center("THINK. LEARN. LEAD.", height - 138, 11, regular, SILVER);
  center("CERTIFICADO DE FINALIZACIÓN", height - 200, 16, bold, ELECTRIC);
  center("Se certifica que", height - 240, 13, regular, SILVER);
  center(c.studentName, height - 285, 34, bold);
  center("ha completado satisfactoriamente la formación", height - 325, 13, regular, SILVER);
  center(c.courseTitle, height - 365, 22, bold);
  center(`Fecha de emisión: ${formatDate(c.issuedAt)}`, height - 405, 12, regular, SILVER);

  if (c.signerName) {
    page.drawLine({ start: { x: 90, y: 110 }, end: { x: 300, y: 110 }, thickness: 0.8, color: SILVER });
    page.drawText(clean(c.signerName), { x: 90, y: 92, size: 12, font: bold, color: SNOW });
    if (c.signerTitle) page.drawText(clean(c.signerTitle), { x: 90, y: 76, size: 10, font: regular, color: SILVER });
  }

  const qr = await QRCode.toBuffer(c.verifyUrl, { margin: 1, width: 240, color: { dark: "#101827", light: "#F4F6FA" } });
  const qrImg = await pdf.embedPng(qr);
  page.drawImage(qrImg, { x: width - 170, y: 60, width: 96, height: 96 });
  page.drawText(`ID: ${c.code}`, { x: width - 330, y: 92, size: 11, font: bold, color: SNOW });
  page.drawText("Verifica su autenticidad en:", { x: width - 330, y: 76, size: 8, font: regular, color: SILVER });
  const urlText = clean(c.verifyUrl);
  page.drawText(urlText.length > 48 ? urlText.slice(0, 48) + "…" : urlText, { x: width - 330, y: 64, size: 7, font: regular, color: SILVER });

  return Buffer.from(await pdf.save());
}
