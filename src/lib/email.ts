import "server-only";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; text: string; html?: string };

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function layoutEmail(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escape(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escape(cta.url)}" style="background:#087BFF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escape(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Arial,sans-serif;color:#101827">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="background:#101827;color:#F4F6FA;padding:20px 24px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:4px;font-size:22px">JND</div>
<div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px">
<h1 style="font-size:20px;margin:0 0 16px">${escape(title)}</h1>${body}${button}</div>
<p style="color:#929BAA;font-size:12px;text-align:center;margin-top:16px;letter-spacing:2px">THINK. LEARN. LEAD.</p>
</div></body></html>`;
}

export async function sendEmail(mail: Mail) {
  if (env.email.driver === "resend" && env.email.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.email.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.email.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) console.error("Error enviando email", res.status, await res.text().catch(() => ""));
    return;
  }
  // Desarrollo: el correo se muestra en la consola del servidor
  console.info(`\n──── EMAIL (dev) ────\nPara: ${mail.to}\nAsunto: ${mail.subject}\n\n${mail.text}\n─────────────────────\n`);
}

export async function sendTemplate(to: string, title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const text = [...paragraphs, cta ? `${cta.label}: ${cta.url}` : ""].filter(Boolean).join("\n\n");
  await sendEmail({ to, subject: `${title} · JND`, text, html: layoutEmail(title, paragraphs, cta) });
}
