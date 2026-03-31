import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

const TELEGRAM_SEND_URL = "https://biapp.com.mx/api/telegram/send";

// ── Trigger: nueva solicitud de demo ─────────────────────────────────────────
export const onNuevoDemo = onDocumentCreated("demos/{demoId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data     = snap.data();
  const nombre   = data.nombre   ?? "Sin nombre";
  const email    = data.email    ?? "—";
  const telefono = data.telefono ?? "—";
  const empresa  = data.empresa  ?? "—";
  const rol      = data.rol      ?? "—";
  const fecha    = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  // ── 1. Leer destinatarios Telegram desde Firestore ──────────────────────────
  let chatIds: string[] = [];
  try {
    const configSnap = await admin.firestore().doc("config/telegram").get();
    if (configSnap.exists) chatIds = configSnap.data()?.demoNotifyChats ?? [];
  } catch (err) {
    console.error("Error leyendo config/telegram:", err);
  }

  // ── 2. Notificación Telegram ────────────────────────────────────────────────
  if (chatIds.length > 0) {
    const mensaje =
      `🗓️ *Nueva Solicitud de Demo*\n\n` +
      `👤 *${nombre}*\n` +
      `🏢 ${empresa}\n` +
      `💼 ${rol}\n` +
      `📧 ${email}\n` +
      `📱 ${telefono}\n` +
      `🕐 ${fecha}\n\n` +
      `_Gestiona desde el bot → Ventas → Solicitudes de Demo_`;

    await Promise.allSettled(
      chatIds.map((chatId) =>
        fetch(TELEGRAM_SEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, text: mensaje }),
        }).catch((err) => console.error(`Error notificando chatId ${chatId}:`, err))
      )
    );
  }

  // ── 3. Notificación por correo (colección mail — mismo patrón del sistema) ──
  const emailRecipients: string[] = [];
  try {
    const emailSnap = await admin.firestore().doc("config/email").get();
    if (emailSnap.exists) {
      const emails = emailSnap.data()?.demoNotifyEmails ?? [];
      emailRecipients.push(...emails);
    }
  } catch (err) {
    console.error("Error leyendo config/email:", err);
  }

  // Fallback si Firestore no tiene destinatarios configurados
  if (emailRecipients.length === 0) {
    emailRecipients.push("jsoriano@bi2.mx", "jsorglez@gmail.com");
  }

  await admin.firestore().collection("mail").add({
    to: emailRecipients,
    message: {
      subject: `🗓️ Nueva solicitud de demo — ${nombre} (${empresa})`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#002e2e,#006868);padding:32px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">🗓️ Nueva Solicitud de Demo</h1>
            <p style="color:#b2ffee;margin:8px 0 0;font-size:14px;">ERP Bi2 — bi2.mx</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#002e2e;font-size:15px;margin:0 0 24px;">Se ha recibido una nueva solicitud de demostración del sistema ERP Bi2.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr style="background:#004d4d;">
                <td colspan="2" style="padding:12px 20px;color:#fff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Datos del Prospecto</td>
              </tr>
              <tr>
                <td style="padding:13px 20px;color:#64748b;font-size:13px;width:120px;font-weight:600;">👤 Nombre</td>
                <td style="padding:13px 20px;color:#002e2e;font-size:15px;font-weight:700;">${nombre}</td>
              </tr>
              <tr style="background:#f0f4f8;">
                <td style="padding:13px 20px;color:#64748b;font-size:13px;font-weight:600;">🏢 Empresa</td>
                <td style="padding:13px 20px;color:#002e2e;font-size:14px;">${empresa}</td>
              </tr>
              <tr>
                <td style="padding:13px 20px;color:#64748b;font-size:13px;font-weight:600;">💼 Rol</td>
                <td style="padding:13px 20px;color:#002e2e;font-size:14px;">${rol}</td>
              </tr>
              <tr style="background:#f0f4f8;">
                <td style="padding:13px 20px;color:#64748b;font-size:13px;font-weight:600;">📧 Correo</td>
                <td style="padding:13px 20px;font-size:14px;"><a href="mailto:${email}" style="color:#006868;font-weight:600;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:13px 20px;color:#64748b;font-size:13px;font-weight:600;">📱 Teléfono</td>
                <td style="padding:13px 20px;font-size:14px;"><a href="tel:${telefono}" style="color:#006868;">${telefono}</a></td>
              </tr>
              <tr style="background:#f0f4f8;">
                <td style="padding:13px 20px;color:#64748b;font-size:13px;font-weight:600;">🕐 Fecha</td>
                <td style="padding:13px 20px;color:#94a3b8;font-size:13px;">${fecha}</td>
              </tr>
            </table>
            <div style="text-align:center;margin-top:32px;">
              <a href="https://t.me/biapp_bot" style="display:inline-block;background:linear-gradient(135deg,#002e2e,#006868);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">Gestionar en Bot Telegram →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">ERP Business Inteligent · <a href="https://bi2.mx" style="color:#006868;">bi2.mx</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    },
  });

  console.log(`Correo interno encolado para: ${emailRecipients.join(", ")}`);

  // ── 4. Correo de confirmación al prospecto ──────────────────────────────────
  if (!email || email === "—") {
    console.log("Demo sin email válido — omitiendo correo al prospecto.");
    return;
  }

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  const demoId = event.params.demoId;

  await admin.firestore().collection("onboarding_tokens").doc(token).set({
    demoId,
    nombre,
    email,
    empresa,
    rol,
    telefono,
    usado:    false,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    expiraEn: admin.firestore.Timestamp.fromDate(expiresAt),
  });

  const wizardLink = `https://bi2.mx/onboarding.html?token=${token}`;

  await admin.firestore().collection("mail").add({
    to: [email],
    message: {
      subject: `✅ Confirma tu correo — ERP Bi2`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#002e2e,#006868);padding:40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">✅ ¡Gracias por tu interés en ERP Bi2!</h1>
            <p style="color:#b2ffee;margin:10px 0 0;font-size:15px;">Confirma tu correo para continuar</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#002e2e;font-size:16px;margin:0 0 12px;">Hola <strong>${nombre}</strong>,</p>
            <p style="color:#475569;font-size:15px;margin:0 0 28px;">
              Recibimos tu solicitud para <strong>${empresa}</strong>. Para continuar con el proceso,
              haz clic en el botón de abajo para confirmar tu correo y configurar tu acceso al sistema.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${wizardLink}"
                 style="display:inline-block;background:linear-gradient(135deg,#002e2e,#006868);color:#fff;text-decoration:none;padding:16px 40px;border-radius:50px;font-weight:700;font-size:17px;letter-spacing:.3px;">
                Confirmar correo y continuar →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 8px;">Este enlace es válido por <strong>7 días</strong>.</p>
            <p style="color:#cbd5e1;font-size:12px;text-align:center;word-break:break-all;margin:0;">${wizardLink}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">ERP Business Inteligent · <a href="https://bi2.mx" style="color:#006868;">bi2.mx</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    },
  });

  console.log(`Correo de confirmación encolado para prospecto: ${email}`);
});

// ── Trigger: demo aprobado → (reservado para flujo alternativo) ───────────────
export const onDemoAprobado = onDocumentUpdated("demos/{demoId}", async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;

  // Solo cuando el estado cambia A "aprobado"
  if (before.estado === "aprobado" || after.estado !== "aprobado") return;

  const demoId  = event.params.demoId;
  const nombre  = after.nombre  ?? "Sin nombre";
  const email   = after.email   ?? "";
  const empresa = after.empresa ?? "—";

  if (!email) {
    console.error("Demo sin email, no se puede enviar onboarding:", demoId);
    return;
  }

  // Generar token único
  const token    = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  await admin.firestore().collection("onboarding_tokens").doc(token).set({
    demoId,
    nombre,
    email,
    empresa,
    rol:      after.rol      ?? "",
    telefono: after.telefono ?? "",
    usado:    false,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    expiraEn: admin.firestore.Timestamp.fromDate(expiresAt),
  });

  const wizardLink = `https://bi2.mx/onboarding.html?token=${token}`;

  await admin.firestore().collection("mail").add({
    to: [email],
    message: {
      subject: `🚀 Tu acceso al ERP Bi2 está listo — ${empresa}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#002e2e,#006868);padding:40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">🚀 ¡Tu acceso está listo!</h1>
            <p style="color:#b2ffee;margin:10px 0 0;font-size:15px;">ERP Bi2 — Configura tu empresa en minutos</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#002e2e;font-size:16px;margin:0 0 12px;">Hola <strong>${nombre}</strong>,</p>
            <p style="color:#475569;font-size:15px;margin:0 0 28px;">Tu solicitud de demo para <strong>${empresa}</strong> ha sido aprobada. Haz clic en el botón de abajo para completar el registro y configurar tu empresa en el sistema.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${wizardLink}"
                 style="display:inline-block;background:linear-gradient(135deg,#002e2e,#006868);color:#fff;text-decoration:none;padding:16px 40px;border-radius:50px;font-weight:700;font-size:17px;letter-spacing:.3px;">
                Completar Registro →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 8px;">Este enlace expira en <strong>7 días</strong>.</p>
            <p style="color:#cbd5e1;font-size:12px;text-align:center;word-break:break-all;margin:0;">${wizardLink}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">ERP Business Inteligent · <a href="https://bi2.mx" style="color:#006868;">bi2.mx</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    },
  });

  console.log(`Onboarding token creado: ${token} para ${email}`);
});
