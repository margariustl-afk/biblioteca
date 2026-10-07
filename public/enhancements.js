import { getApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js';
import { VAPID_PUBLIC_KEY } from '/config.js';

const $ = id => document.getElementById(id);
const UID = 'r3xm9ySbNjQpO55ZfWXbz1pypXb2';
const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const key = 'biblioteca-install-offers-v1';
const deviceKey = 'biblioteca-device-id-v1';
const modeKey = 'biblioteca-notification-mode-v1';
const alertKey = 'biblioteca-daily-alert-v1';
let deferredInstall = null;
let messaging = null;
let pushWorker = null;
let pwaWorker = null;
let activeUser = null;
let previousFocus = null;
let dailyTimer = null;
let alreadyListening = false;
const deviceId = (() => {
  let value = localStorage.getItem(deviceKey);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(deviceKey, value); }
  return value;
})();
let mode = localStorage.getItem(modeKey) || 'off';

function say(text) { $('live').textContent = text; }
function permissionText() {
  const status = !('Notification' in window) ? 'Este navegador no permite notificaciones.' :
    Notification.permission === 'granted' ? 'Permiso concedido.' :
    Notification.permission === 'denied' ? 'Permiso bloqueado. Cámbialo en la configuración del sitio.' :
    'Permiso pendiente. Pulsa “Solicitar permiso para notificaciones”.';
  $('permissionStatus').textContent = status;
}
function status(text) { $('pushStatus').textContent = text; say(text); }
function deviceRef() { return doc(db, 'dispositivos', deviceId); }
function selectedMode() { return document.querySelector('input[name="notificationMode"]:checked')?.value || 'off'; }
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function ensureMessaging() {
  if (!('serviceWorker' in navigator) || !await isSupported()) return false;
  if (!pushWorker) pushWorker = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });
  if (!messaging) messaging = getMessaging(app);
  if (!alreadyListening) {
    onMessage(messaging, payload => {
      if (!activeUser || mode === 'off') return;
      const isDaily = payload.data?.kind === 'daily';
      if (mode === 'daily' && !isDaily) return;
      if (isDaily && localStorage.getItem(alertKey) === localDate()) return;
      if (isDaily) localStorage.setItem(alertKey, localDate());
      showNotice(payload.data?.title || 'Biblioteca', payload.data?.body || 'Tienes una alerta de la biblioteca.');
    });
    alreadyListening = true;
  }
  return true;
}
async function saveMode(nextMode) {
  if (!activeUser) return;
  mode = nextMode;
  localStorage.setItem(modeKey, mode);
  if (mode === 'off') {
    try { if (messaging) await deleteToken(messaging); } catch (error) { console.warn('No se pudo retirar la suscripción:', error); }
    await deleteDoc(deviceRef());
    status('Notificaciones apagadas en este dispositivo.');
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    status('Preferencia guardada. Para recibir avisos, concede permiso con el botón de esta página.');
    return;
  }
  if (!VAPID_PUBLIC_KEY) {
    status('Preferencia guardada. Falta agregar la clave pública VAPID en config.js para recibir push con la aplicación cerrada.');
    return;
  }
  try {
    if (!await ensureMessaging()) { status('Este navegador no admite Firebase Cloud Messaging.'); return; }
    const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: pushWorker });
    if (!token) { status('Firebase no entregó un identificador de notificaciones para este dispositivo.'); return; }
    await setDoc(deviceRef(), { token, mode, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, updatedAt: serverTimestamp() }, { merge: true });
    status('Notificaciones activadas en este dispositivo.');
  } catch (error) {
    console.error(error);
    status('No fue posible activar el push. Revisa la clave VAPID, el permiso y la configuración de Cloud Messaging.');
  }
}
async function showNotice(title, body) {
  say(`${title}. ${body}`);
  if (Notification.permission !== 'granted') return;
  try {
    const worker = pwaWorker || await navigator.serviceWorker.ready;
    await worker.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'biblioteca-' + title, data: { url: '/' } });
  } catch (error) { console.error(error); status('No se pudo mostrar la notificación de prueba.'); }
}
function checkDaily() {
  if (!activeUser || mode === 'off') return;
  const now = new Date();
  if (now.getHours() === 20 && now.getMinutes() >= 30 && localStorage.getItem(alertKey) !== localDate()) {
    localStorage.setItem(alertKey, localDate());
    showNotice('Biblioteca: cierre del día', 'Son las 20:30. Revisa las visitas y pendientes del día.');
  }
}
function closeInstall() {
  $('installDialog').hidden = true;
  previousFocus?.focus();
}
function offerInstall() {
  if (!activeUser || $('installDialog').hidden === false || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  const count = Number(localStorage.getItem(key) || 0);
  if (count >= 3) return;
  localStorage.setItem(key, String(count + 1));
  previousFocus = document.activeElement;
  $('installDialog').hidden = false;
  $('installTitle').focus();
}

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
window.addEventListener('appinstalled', () => { closeInstall(); localStorage.setItem(key, '3'); say('Aplicación instalada.'); });
$('installCloseBtn').addEventListener('click', closeInstall);
$('installDialog').addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeInstall(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...$('installDialog').querySelectorAll('button')];
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && [first, $('installTitle')].includes(document.activeElement)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$('installBtn').addEventListener('click', async () => {
  if (deferredInstall) {
    await deferredInstall.prompt();
    const result = await deferredInstall.userChoice;
    deferredInstall = null;
    if (result.outcome === 'accepted') closeInstall();
    else $('installHelp').textContent = 'Puedes instalar la aplicación más tarde desde el menú del navegador.';
  } else $('installHelp').textContent = 'Abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”, si está disponible.';
});
$('permissionBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) { permissionText(); return; }
  if (Notification.permission === 'default') await Notification.requestPermission();
  permissionText();
  if (Notification.permission === 'granted' && mode !== 'off') await saveMode(mode);
});
$('testNotificationBtn').addEventListener('click', async () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') { status('Concede primero el permiso de notificaciones.'); return; }
  await showNotice('Prueba de biblioteca', 'Las notificaciones funcionan en este dispositivo.');
  status('Se solicitó mostrar una notificación de prueba en este dispositivo.');
});
document.querySelectorAll('input[name="notificationMode"]').forEach(input => input.addEventListener('change', () => saveMode(selectedMode())));
$('logoutBtn').addEventListener('click', async event => {
  event.stopImmediatePropagation();
  try {
    if (messaging) await deleteToken(messaging);
    await deleteDoc(deviceRef());
  } catch (error) { console.warn('No se pudo retirar la suscripción:', error); }
  await signOut(auth);
}, true);
document.querySelector(`input[name="notificationMode"][value="${['off','daily','all'].includes(mode) ? mode : 'off'}"]`).checked = true;
permissionText();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').then(reg => { pwaWorker = reg; }).catch(error => console.warn('No se pudo registrar la aplicación:', error));
onAuthStateChanged(auth, async user => {
  activeUser = user?.uid === UID ? user : null;
  clearInterval(dailyTimer);
  if (!activeUser) { if (!$('installDialog').hidden) closeInstall(); return; }
  dailyTimer = setInterval(checkDaily, 30_000);
  checkDaily();
  setTimeout(offerInstall, 1000);
  if (mode !== 'off' && 'Notification' in window && Notification.permission === 'granted') await saveMode(mode);
});
