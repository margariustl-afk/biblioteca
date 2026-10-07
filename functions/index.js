const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

function localParts(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

async function sendToDevice(device, title, body, kind, tag) {
  const token = device.data().token;
  if (!token) return false;
  try {
    await getMessaging().send({ token, data: { title, body, kind, tag } });
    return true;
  } catch (error) {
    if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(error.code)) {
      await device.ref.delete();
    } else console.error('Error de FCM para dispositivo', device.id, error);
    return false;
  }
}

exports.dailyClosingAlert = onSchedule({
  schedule: 'every 15 minutes', timeZone: 'Etc/UTC', region: 'us-central1',
  maxInstances: 1
}, async () => {
  const devices = await db.collection('dispositivos').get();
  const now = new Date();
  for (const device of devices.docs) {
    const value = device.data();
    if (!['daily', 'all'].includes(value.mode) || !value.timezone) continue;
    let local;
    try { local = localParts(value.timezone, now); } catch (error) { console.error('Zona horaria inválida', device.id); continue; }
    if (local.hour !== '20' || Number(local.minute) < 30 || Number(local.minute) >= 45) continue;
    const today = `${local.year}-${local.month}-${local.day}`;
    if (value.lastDailyDate === today) continue;
    const sent = await sendToDevice(device, 'Biblioteca: cierre del día', 'Son las 20:30. Revisa las visitas y pendientes del día.', 'daily', `biblioteca-daily-${today}`);
    if (sent) await device.ref.update({ lastDailyDate: today, lastDailyAt: FieldValue.serverTimestamp() });
  }
});

exports.newVisitAlert = onDocumentCreated({ document: 'visitas/{visitId}', region: 'us-central1' }, async event => {
  const visit = event.data?.data();
  if (!visit) return;
  const name = String(visit.nombre || 'Una persona').slice(0, 80);
  const devices = await db.collection('dispositivos').where('mode', '==', 'all').get();
  await Promise.all(devices.docs.map(device => sendToDevice(device, 'Nueva visita registrada', `${name} registró una visita en la biblioteca.`, 'visit', `biblioteca-visit-${event.params.visitId}`)));
});
