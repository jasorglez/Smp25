import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

const TELEGRAM_SEND_URL = "https://biapp.com.mx/api/telegram/send";
const ADMIN_EMAIL       = "jsoriano@bi2.mx";

// ── Helpers de validación ────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Trigger: nueva solicitud de demo ─────────────────────────────────────────
// Valida los datos y auto-aprueba sin pasar por el Bot de Telegram.
// Si la validación falla, marca el demo como "rechazado_auto" y no envía nada.
export const onNuevoDemo = onDocumentCreated("demos/{demoId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data     = snap.data();
  const demoId   = event.params.demoId;
  const nombre   = (data.nombre   ?? "").trim();
  const email    = (data.email    ?? "").trim();
  const telefono = (data.telefono ?? "").trim();
  const empresa  = (data.empresa  ?? "").trim();
  const rol      = (data.rol      ?? "").trim();
  const fecha    = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  // ── 1. Validación básica ────────────────────────────────────────────────────
  const errores: string[] = [];
  if (!nombre)            errores.push("Nombre vacío");
  if (!email)             errores.push("Email vacío");
  if (!isValidEmail(email)) errores.push("Email inválido");
  if (!empresa)           errores.push("Empresa vacía");
  if (!telefono)          errores.push("Teléfono vacío");
  if (!rol)               errores.push("Rol vacío");

  // Verificar duplicado: email ya tiene demo aprobado o pendiente
  if (email && isValidEmail(email)) {
    const dupSnap = await admin.firestore()
      .collection("demos")
      .where("email", "==", email)
      .where("estado", "in", ["pendiente", "aprobado"])
      .get();

    // Excluir el documento actual
    const duplicados = dupSnap.docs.filter(d => d.id !== demoId);
    if (duplicados.length > 0) {
      errores.push("Email ya tiene una solicitud activa");
    }
  }

  // ── 2. Notificación Telegram (siempre) ─────────────────────────────────────
  let chatIds: string[] = [];
  try {
    const configSnap = await admin.firestore().doc("config/telegram").get();
    if (configSnap.exists) chatIds = configSnap.data()?.demoNotifyChats ?? [];
  } catch (err) {
    console.error("Error leyendo config/telegram:", err);
  }

  if (chatIds.length > 0) {
    const estadoMsg = errores.length > 0
      ? `❌ *Auto-rechazado*: ${errores.join(", ")}`
      : "✅ *Auto-aprobado* — se enviará link de onboarding";

    const mensaje =
      `🗓️ *Nueva Solicitud de Demo*\n\n` +
      `👤 *${nombre}*\n🏢 ${empresa}\n💼 ${rol}\n📧 ${email}\n📱 ${telefono}\n🕐 ${fecha}\n\n` +
      estadoMsg;

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

  // ── 3. Si falla validación → rechazar y salir ───────────────────────────────
  if (errores.length > 0) {
    console.warn(`Demo ${demoId} rechazado automáticamente: ${errores.join(", ")}`);
    await admin.firestore().collection("demos").doc(demoId).update({
      estado:                   "rechazado_auto",
      motivoRechazo:            errores.join(", "),
      fechaUltimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  // ── 4. Auto-aprobar → dispara onDemoAprobado ────────────────────────────────
  await admin.firestore().collection("demos").doc(demoId).update({
    estado:                   "aprobado",
    fechaUltimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Demo ${demoId} auto-aprobado para ${email}`);
});

// ── Trigger: demo aprobado → genera token y envía link de onboarding ─────────
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
  const token     = uuidv4();
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

  // ── Email al usuario + copia al admin ──────────────────────────────────────
  await admin.firestore().collection("mail").add({
    to:      [email, ADMIN_EMAIL],
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
            <p style="color:#475569;font-size:15px;margin:0 0 28px;">
              Tu solicitud de demo para <strong>${empresa}</strong> ha sido aprobada.
              Haz clic en el botón de abajo para completar el registro y configurar tu empresa en el sistema.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${wizardLink}"
                 target="_blank"
                 style="display:inline-block;background:linear-gradient(135deg,#002e2e,#006868);color:#fff;text-decoration:none;padding:16px 40px;border-radius:50px;font-weight:700;font-size:17px;letter-spacing:.3px;">
                Completar Registro →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 8px;">
              Este enlace expira en <strong>7 días</strong>.
            </p>
            <p style="font-size:12px;text-align:center;word-break:break-all;margin:0;">
              <a href="${wizardLink}" target="_blank" style="color:#006868;">${wizardLink}</a>
            </p>
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

  console.log(`Onboarding token creado: ${token} para ${email} — copia a ${ADMIN_EMAIL}`);
});
