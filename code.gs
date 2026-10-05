/**
 * Google Apps Script - Sincronizador de Tutorías de Google Calendar
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Entra a https://script.google.com y crea un "Nuevo proyecto".
 * 2. Pega este código completo reemplazando el contenido existente.
 * 3. Haz clic en "Implementar" (Deploy) > "Nueva implementación" (New deployment).
 * 4. Selecciona tipo: "Aplicación web" (Web app).
 * 5. Configuración:
 *    - Ejecutar como: "Yo" (tu cuenta)
 *    - Quién tiene acceso: "Cualquiera" (Anyone) -> necesario para que tu web pueda leer los datos.
 * 6. Haz clic en "Implementar", autoriza los permisos y copia la URL proporcionada.
 * 7. Pega esa URL en tu aplicación Horario con el botón "Sincronizar Calendar".
 */

function doGet() {
  try {
    var tutorias = leerEventosSemanales();
    return ContentService.createTextOutput(JSON.stringify(tutorias))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function leerEventosSemanales() {
  // ID del calendario institucional decodificado de tu enlace:
  var calendarId = "";
  var cal = CalendarApp.getCalendarById(calendarId);

  var hoy = new Date();

  // 1. INICIO: Hoy a las 00:00:00
  // Desaparecen los días anteriores de la semana que ya concluyeron
  var desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);

  // 2. FIN: Domingo de la semana actual a las 23:59:59
  var diaSemana = hoy.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  var diasHastaFinDeSemana = diaSemana === 0 ? 0 : (7 - diaSemana);
  var hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasHastaFinDeSemana, 23, 59, 59, 999);

  // 3. FILTRO: Comienzan con "Tutoría" o "Tutoria" (insensible a mayúsculas y tildes)
  var regexTutoria = /^tutor[íi]a/i;

  var resultado = [];

  cal.getEvents(desde, hasta).forEach(function (evento) {
    var titulo = evento.getTitle().trim();
    if (!regexTutoria.test(titulo)) return;

    resultado.push({
      titulo: titulo,
      inicio: evento.getStartTime().toISOString()
    });
  });

  return resultado;
}
