const OWNER_EMAIL = process.env.OWNER_EMAIL || "vaharuchulu.pickles@gmail.com";
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

export function isEmailConfigured() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

async function getTransporter() {
  if (!isEmailConfigured()) return null;
  const nodemailer = await import("nodemailer");
  return nodemailer.default.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
}

function formatItemsHtml(items) {
  return items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.weightLabel}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.qty}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${item.subtotal.toLocaleString("en-IN")}</td>
        </tr>`
    )
    .join("");
}

function orderEmailLayout({ title, intro, order, extraHtml = "" }) {
  const itemsHtml = formatItemsHtml(order.items);
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
      <div style="background:#0B4F2A;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:22px;">Vaha Ruchulu</h1>
        <p style="margin:6px 0 0;opacity:0.9;">${title}</p>
      </div>
      <div style="background:#FFF8E7;padding:24px;border:1px solid #e8dfc8;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin-top:0;line-height:1.6;">${intro}</p>
        <p style="font-size:18px;font-weight:bold;color:#0B4F2A;">Order ID: ${order.id}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f5f0e6;">
              <th style="padding:8px;text-align:left;">Item</th>
              <th style="padding:8px;text-align:left;">Size</th>
              <th style="padding:8px;text-align:center;">Qty</th>
              <th style="padding:8px;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="font-size:18px;font-weight:bold;text-align:right;">Total: ₹${order.total.toLocaleString("en-IN")}</p>
        <div style="background:#fff;padding:14px;border-radius:8px;margin-top:16px;line-height:1.7;">
          <strong>Customer details</strong><br/>
          Name: ${order.customer.name}<br/>
          Phone: ${order.customer.phone}<br/>
          ${order.customer.email ? `Email: ${order.customer.email}<br/>` : ""}
          Address: ${order.customer.address}
        </div>
        ${extraHtml}
        <p style="color:#666;font-size:13px;margin-bottom:0;">Homemade with love from home · Vaha Ruchulu</p>
      </div>
    </div>
  `;
}

export async function sendNewOrderEmails(order) {
  const transporter = await getTransporter();
  if (!transporter) return { sent: false, reason: "email_not_configured" };

  const ownerHtml = orderEmailLayout({
    title: "New order received",
    intro: "A new order has been placed on your website. Details are below.",
    order,
    extraHtml: `<p style="margin-top:16px;"><strong>Status:</strong> Awaiting payment</p>
      <p>Reply to the customer on WhatsApp to share UPI / payment details.</p>`,
  });

  await transporter.sendMail({
    from: `"Vaha Ruchulu Orders" <${GMAIL_USER}>`,
    to: OWNER_EMAIL,
    subject: `New Order ${order.id} — ₹${order.total.toLocaleString("en-IN")}`,
    html: ownerHtml,
  });

  if (order.customer.email) {
    const customerHtml = orderEmailLayout({
      title: "Order confirmation",
      intro: `Hi ${order.customer.name}, thank you for your order! We have received your request.`,
      order,
      extraHtml: `<p style="margin-top:16px;"><strong>Payment status:</strong> Pending</p>
        <p>We will share UPI / GPay / PhonePe or bank details on WhatsApp shortly. Please complete payment to confirm your order.</p>
        <p>You can also message us on WhatsApp at +91 8501831638 with your order ID.</p>`,
    });

    await transporter.sendMail({
      from: `"Vaha Ruchulu" <${GMAIL_USER}>`,
      to: order.customer.email,
      subject: `Order Confirmed ${order.id} — Vaha Ruchulu`,
      html: customerHtml,
    });
  }

  return { sent: true };
}

export async function sendPaymentConfirmedEmail(order) {
  const transporter = await getTransporter();
  if (!transporter || !order.customer.email) return { sent: false };

  const html = orderEmailLayout({
    title: "Payment confirmed",
    intro: `Hi ${order.customer.name}, your payment for order ${order.id} has been confirmed. Thank you!`,
    order,
    extraHtml: `<p style="margin-top:16px;"><strong>Payment status:</strong> Confirmed ✓</p>
      <p>We are preparing your order fresh. You will receive dispatch updates on WhatsApp.</p>`,
  });

  await transporter.sendMail({
    from: `"Vaha Ruchulu" <${GMAIL_USER}>`,
    to: order.customer.email,
    subject: `Payment Confirmed — Order ${order.id}`,
    html,
  });

  if (OWNER_EMAIL !== order.customer.email) {
    await transporter.sendMail({
      from: `"Vaha Ruchulu Orders" <${GMAIL_USER}>`,
      to: OWNER_EMAIL,
      subject: `Payment marked confirmed — ${order.id}`,
      html: orderEmailLayout({
        title: "Payment confirmed",
        intro: `Payment for order ${order.id} has been marked as confirmed.`,
        order,
      }),
    });
  }

  return { sent: true };
}
