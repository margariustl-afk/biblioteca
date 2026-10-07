# Biblioteca web para Firebase Hosting

Este paquete parte del `index (4).html` de la biblioteca y conserva sus pantallas de inicio de sesión, registro de usuarios, visitas y estadísticas. El acceso a Firestore sigue restringido al UID `r3xm9ySbNjQpO55ZfWXbz1pypXb2`.

## Configuración antes de publicar

1. En Firebase Authentication, habilita **Correo electrónico y contraseña** y verifica que el usuario autorizado tenga el UID indicado. En Firestore, crea la base de datos si aún no existe.
2. En **Configuración del proyecto > Cloud Messaging > Configuración web > Certificados push web**, genera una clave VAPID. Copia **solo la clave pública** en `public/config.js`. No coloques la clave privada ni credenciales de servicio en archivos de Hosting.
3. Habilita **Firebase Cloud Messaging API** y **FCM Registration API** si Firebase lo solicita. Para desplegar Cloud Functions y Cloud Scheduler, el proyecto necesita el plan Blaze y las API correspondientes habilitadas.
4. Desde esta carpeta, instala Firebase CLI si todavía no la tienes, inicia sesión con una cuenta que administre `biblioteca-623e5`, instala dependencias con `npm --prefix functions install`, y publica con `firebase deploy --only hosting,firestore:rules,functions`.
5. Abre la dirección HTTPS de Firebase Hosting. En **Configuración > Notificaciones**, selecciona un modo, solicita permiso y prueba la notificación. Para verificar push con la aplicación cerrada, deja una pestaña en segundo plano o cierra la app y usa un mensaje de prueba de Cloud Messaging con el token de un dispositivo registrado; el token se guarda en Firestore, colección `dispositivos`.

## Funcionamiento y límites

- La invitación de instalación aparece como máximo **tres veces por navegador y perfil** después de iniciar sesión. El contador se guarda en `localStorage`. Si se borran los datos del sitio o se usa otro navegador, el contador empieza de nuevo. Un sitio web no puede contar de forma fiable por IP sin backend; además, una IP puede ser compartida o cambiar.
- **Apagadas** retira la suscripción push de este dispositivo. **Una al día** recibe solo el aviso de cierre. **Todas** recibe el aviso de cierre y una alerta por nueva visita.
- Con la página abierta, la aplicación también comprueba la hora local y muestra la alerta al llegar a las **20:30**. Con la página cerrada, `dailyClosingAlert` envía el push desde Firebase según la zona horaria registrada por cada dispositivo. Cloud Scheduler se ejecuta cada 15 minutos, por lo que el aviso puede llegar entre las 20:30 y las 20:44, o más tarde por retrasos de la plataforma o del dispositivo. La entrega push no es garantizada si el dispositivo está apagado, sin conexión o el sistema operativo limita el navegador.
- El botón **Probar notificación** comprueba el permiso y la presentación local. Para comprobar toda la ruta push, usa la prueba de FCM. El navegador debe admitir Service Workers y notificaciones; en iPhone/iPad suele requerirse instalar la web en la pantalla de inicio antes de recibir web push.
- La PWA es instalable; se necesita conexión para cargar el SDK de Firebase y para leer o guardar datos. No se ofrecen registros sin conexión para evitar aparentar que se guardaron datos que el servidor aún no recibió.

## Archivos

- `public/index.html`: sistema original actualizado.
- `public/enhancements.js`: instalación, ajustes y notificaciones.
- `public/config.js`: clave pública VAPID por completar.
- `public/service-worker.js`: recursos PWA.
- `public/firebase-messaging-sw.js`: recepción push en segundo plano.
- `functions/index.js`: alertas diarias y de visitas.
- `firestore.rules`: protección de las colecciones de usuarios, visitas y dispositivos.
