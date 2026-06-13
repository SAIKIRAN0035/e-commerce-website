import { createPasswordReset } from "../../server/lib/adminStore.js";

async function sendResetEmail(code) {
  const ownerEmail = process.env.OWNER_EMAIL || "vaharuchulu.pickles@gmail.com";

  try {
    const { isEmailConfigured } = await import("../../server/lib/email.js");
    if (!isEmailConfigured()) {
      return { sent: false, reason: "email_not_configured" };
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    await Promise.race([
      transporter.sendMail({
        from: `"Vaha Ruchulu" <${process.env.GMAIL_USER}>`,
        to: ownerEmail,
        subject: "Owner password reset code — Vaha Ruchulu",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="color:#0B4F2A;">Password reset</h2>
            <p>Use this code on your website to set a new owner password:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#0B4F2A;">${code}</p>
            <p style="color:#666;">Valid for 15 minutes. If you did not request this, ignore this email.</p>
            <p>Website → Footer → Owner → Forgot password</p>
          </div>
        `,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);

    return { sent: true };
  } catch {
    return { sent: false, reason: "email_failed" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Storage not configured." });
  }

  try {
    const { code } = await createPasswordReset();
    const emailResult = await sendResetEmail(code);

    if (!emailResult.sent) {
      return res.status(503).json({
        error:
          "Could not send reset email. Set up Gmail App Password in Vercel (see Google Account → App passwords).",
      });
    }

    const ownerEmail = process.env.OWNER_EMAIL || "vaharuchulu.pickles@gmail.com";
    return res.status(200).json({
      ok: true,
      message: `Reset code sent to ${ownerEmail.replace(/(.{2}).+(@.+)/, "$1***$2")}`,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Could not send reset code." });
  }
}
