import { Email } from "../Types/email";
import {
  emailEnabled,
  escapeHtml,
  htmlToText,
  sendMailSync,
} from "./mailer";
import { enqueueEmail, isEmailQueueReady } from "./emailQueue";

function buildMessage(email: Email) {
  const safeName = escapeHtml(email?.name || "");
  const safeMessage = email?.message || "";

  const html = `
    <html>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
          <header style="background-color: #2FC1FF; color: white; padding: 10px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">YALI Alumni Management System</h1>
          </header>

          <div style="padding: 20px;">
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${safeName},</p>
            <div style="font-size: 16px; line-height: 1.5; color: #333;">
              ${safeMessage}
            </div>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Best regards,<br>Admin.</p>
          </div>

          <footer style="background-color: #f4f4f4; padding: 10px; text-align: center; color: #777; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 12px;">&copy; ${new Date().getFullYear()} Alumni Management System. All rights reserved.</p>
            <p style="margin: 0; font-size: 12px;">
              <a href="${process.env.FRONTEND_URL || "#"}" style="color: #0073e6; text-decoration: none;">Unsubscribe</a> |
              <a href="${process.env.FRONTEND_URL || "#"}/privacy" style="color: #0073e6; text-decoration: none;">Privacy Policy</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  `;

  return { html, text: htmlToText(html) };
}

async function sendEmail(replacements: Email) {
  if (!emailEnabled) {
    console.warn("[email] service not configured; skipping:", replacements?.subject);
    return { status: 503, message: "Email service not configured" };
  }

  const { html, text } = buildMessage(replacements);

  try {
    if (isEmailQueueReady()) {
      await enqueueEmail({
        receiver: replacements.receiver,
        subject: replacements.subject,
        html,
        text,
      });
      return { status: 200, queued: true };
    }

    const info = await sendMailSync({
      to: replacements.receiver,
      subject: replacements.subject,
      html,
      text,
    });
    return { status: 200, messageId: info.messageId };
  } catch (error: any) {
    console.error("[email] failed:", error?.message);
    return { status: 500, message: error?.message };
  }
}

export default sendEmail;
export { escapeHtml, emailEnabled };