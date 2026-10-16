import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "./firebase";

const TABLA = "configuracion";
const DOC_CANONICO = "general";

// Valores por defecto basados en la base de datos de LM Scents Boutique
export const CONFIG_DEFAULTS = {
  actualizadoEn: "29 de septiembre del 2026",
  correo: "Lmscents@gmail.com",
  email: "Lmscents@gmail.com",
  direccion: "Blvd. Sonora y Calle Agustín de Iturbide, Puerto Peñasco, Sonora. ",
  googleMapsUrl: "https://maps.app.goo.gl/4G3YvCDNuoK53fKh9",
  horario: " Lunes a Sábado: 10:00 AM - 8:00 PM",
  linkMaps: "https://maps.app.goo.gl/4G3YvCDNuoK53fKh9",
  mapsUrl: "https://maps.app.goo.gl/4G3YvCDNuoK53fKh9",
  nombreComercial: "Lm Scents Boutique",
  nombreTienda: "LM Scents",
  pickupActivo: true,
  pickupBadge: "Inmediato",
  pickupDireccion: "Blvd. Sonora y Calle Agustín de Iturbide, Puerto Peñasco, Sonora. ",
  pickupHorario: " Lunes a Sábado: 10:00 AM - 8:00 PM",
  pickupMapsUrl: "https://maps.app.goo.gl/4G3YvCDNuoK53fKh9",
  pickupTitulo: "LM Scents",
  taxId: "1",
  nit: "1",
  telefono: "6674863190",
  iva: 16,
  facturacionElectronica: false,
  resolucionFacturacion: "",
  anchoPapel: "80mm",
  copiasTicket: 1,
  impresora: "epson",
  encabezadoTicket: "LM SCENTS BOUTIQUE",
  subtituloTicket: "Punto de Venta · Perfumería Exclusiva",
  pieTicket: "¡Gracias por su preferencia! · Cambios con ticket dentro de 7 días",
};

/**
 * Obtiene la configuración desde Firestore.
 * Lee prioritariamente el documento 'general' (y como respaldo 'principal' o colección entera)
 * asegurando mapear exactamente todos los campos de LM Scents.
 */
export async function obtenerConfiguracion() {
  let datos = {};

  try {
    // 1. Consultar documento 'general'
    const refGeneral = doc(db, TABLA, DOC_CANONICO);
    const snapGeneral = await getDoc(refGeneral);
    if (snapGeneral.exists()) {
      datos = { ...snapGeneral.data() };
    }
  } catch (errGeneral) {
    console.warn("Aviso al consultar doc general:", errGeneral);
  }

  // 2. Si 'general' no tenía datos, intentar con 'principal'
  if (Object.keys(datos).length === 0) {
    try {
      const refPrincipal = doc(db, TABLA, "principal");
      const snapPrincipal = await getDoc(refPrincipal);
      if (snapPrincipal.exists()) {
        datos = { ...snapPrincipal.data() };
      }
    } catch (errPrincipal) {
      console.warn("Aviso al consultar doc principal:", errPrincipal);
    }
  }

  // 3. Si aún no hay datos, buscar en cualquier documento de la colección 'configuracion'
  if (Object.keys(datos).length === 0) {
    try {
      const snapCol = await getDocs(collection(db, TABLA));
      if (!snapCol.empty) {
        snapCol.forEach((d) => {
          const dData = d.data();
          if (dData && Object.keys(dData).length > 0) {
            datos = { ...datos, ...dData };
          }
        });
      }
    } catch (errCol) {
      console.warn("Aviso al consultar colección configuracion:", errCol);
    }
  }

  // Normalizar los campos con fallback elegante a los defaults exactos
  const direccionFinal = datos.direccion || datos.pickupDireccion || CONFIG_DEFAULTS.direccion;

  const horarioFinal = datos.horario || datos.pickupHorario || CONFIG_DEFAULTS.horario;

  const mapsUrlFinal =
    datos.googleMapsUrl ||
    datos.mapsUrl ||
    datos.linkMaps ||
    datos.pickupMapsUrl ||
    CONFIG_DEFAULTS.googleMapsUrl;

  const nombreFinal =
    datos.nombreComercial ||
    datos.nombreTienda ||
    datos.pickupTitulo ||
    CONFIG_DEFAULTS.nombreComercial;

  const nombreTiendaFinal = datos.nombreTienda || CONFIG_DEFAULTS.nombreTienda;

  const telefonoFinal = datos.telefono || datos.pickupTelefono || CONFIG_DEFAULTS.telefono;

  const emailFinal = datos.correo || datos.email || CONFIG_DEFAULTS.correo;

  const taxIdFinal = datos.taxId || datos.nit || CONFIG_DEFAULTS.taxId;

  const badgeFinal = datos.pickupBadge || CONFIG_DEFAULTS.pickupBadge;

  const activoFinal =
    typeof datos.pickupActivo === "boolean" ? datos.pickupActivo : CONFIG_DEFAULTS.pickupActivo;

  return {
    ...CONFIG_DEFAULTS,
    ...datos,
    nombreComercial: nombreFinal,
    nombreTienda: nombreTiendaFinal,
    nit: taxIdFinal,
    taxId: taxIdFinal,
    direccion: direccionFinal,
    telefono: telefonoFinal,
    email: emailFinal,
    correo: emailFinal,
    horario: horarioFinal,
    googleMapsUrl: mapsUrlFinal,
    linkMaps: mapsUrlFinal,
    mapsUrl: mapsUrlFinal,
    pickupTitulo: nombreTiendaFinal,
    pickupBadge: badgeFinal,
    pickupDireccion: direccionFinal,
    pickupHorario: horarioFinal,
    pickupMapsUrl: mapsUrlFinal,
    pickupTelefono: telefonoFinal,
    pickupActivo: activoFinal,
    iva: datos.iva ?? 16,
    facturacionElectronica: Boolean(datos.facturacionElectronica),
    resolucionFacturacion: datos.resolucionFacturacion || "",
    anchoPapel: datos.anchoPapel || "80mm",
    copiasTicket: datos.copiasTicket || 1,
    impresora: datos.impresora || "epson",
    encabezadoTicket: datos.encabezadoTicket || CONFIG_DEFAULTS.encabezadoTicket,
    subtituloTicket: datos.subtituloTicket || CONFIG_DEFAULTS.subtituloTicket,
    pieTicket: datos.pieTicket || CONFIG_DEFAULTS.pieTicket,
  };
}

/**
 * Guarda la configuración en Firestore.
 * Escribe la estructura completa de LM Scents en 'general' y mantiene réplicas sincronizadas
 * con compatibilidad absoluta para la app móvil y el POS.
 */
export async function guardarConfiguracion(data) {
  const ahora = new Date();

  const direccionFinal = (
    data.pickupDireccion ||
    data.direccion ||
    CONFIG_DEFAULTS.direccion
  ).trim();

  const horarioFinal = (data.pickupHorario || data.horario || CONFIG_DEFAULTS.horario).trim();

  const mapsUrlFinal = (
    data.pickupMapsUrl ||
    data.googleMapsUrl ||
    data.mapsUrl ||
    data.linkMaps ||
    CONFIG_DEFAULTS.googleMapsUrl
  ).trim();

  const nombreFinal = (data.nombreComercial || CONFIG_DEFAULTS.nombreComercial).trim();

  const nombreTiendaFinal = (
    data.nombreTienda ||
    data.pickupTitulo ||
    CONFIG_DEFAULTS.nombreTienda
  ).trim();

  const telefonoFinal = (data.telefono || data.pickupTelefono || CONFIG_DEFAULTS.telefono).trim();

  const correoFinal = (data.correo || data.email || CONFIG_DEFAULTS.correo).trim();

  const taxIdFinal = (data.taxId || data.nit || CONFIG_DEFAULTS.taxId).trim();

  const badgeFinal = (data.pickupBadge || CONFIG_DEFAULTS.pickupBadge).trim();

  const activoFinal = typeof data.pickupActivo === "boolean" ? data.pickupActivo : true;

  // Carga estructurada con exactamente los campos solicitados por Firestore
  const payloadFirestore = {
    actualizadoEn: ahora.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    correo: correoFinal,
    email: correoFinal,
    direccion: direccionFinal,
    googleMapsUrl: mapsUrlFinal,
    horario: horarioFinal,
    linkMaps: mapsUrlFinal,
    mapsUrl: mapsUrlFinal,
    nombreComercial: nombreFinal,
    nombreTienda: nombreTiendaFinal,
    pickupActivo: activoFinal,
    pickupBadge: badgeFinal,
    pickupDireccion: direccionFinal,
    pickupHorario: horarioFinal,
    pickupMapsUrl: mapsUrlFinal,
    pickupTitulo: nombreTiendaFinal,
    taxId: taxIdFinal,
    nit: taxIdFinal,
    telefono: telefonoFinal,
    timestampActualizacion: ahora,
    // Parámetros de boutique POS
    iva: Number(data.iva) || 16,
    facturacionElectronica: Boolean(data.facturacionElectronica),
    resolucionFacturacion: data.resolucionFacturacion || "",
    impresora: data.impresora || "epson",
    copiasTicket: Number(data.copiasTicket) || 1,
    anchoPapel: data.anchoPapel || "80mm",
    encabezadoTicket: (data.encabezadoTicket || CONFIG_DEFAULTS.encabezadoTicket).trim(),
    subtituloTicket: (data.subtituloTicket || CONFIG_DEFAULTS.subtituloTicket).trim(),
    pieTicket: (data.pieTicket || CONFIG_DEFAULTS.pieTicket).trim(),
  };

  // 1. Guardar en el documento 'general' (documento principal de Firestore)
  const refGeneral = doc(db, TABLA, DOC_CANONICO);
  await setDoc(refGeneral, payloadFirestore, { merge: true });

  // 2. Guardar réplica en 'principal' para garantizar retrocompatibilidad
  try {
    const refPrincipal = doc(db, TABLA, "principal");
    await setDoc(refPrincipal, payloadFirestore, { merge: true });
  } catch (errPrinc) {
    console.warn("Aviso al guardar en configuracion/principal:", errPrinc);
  }

  // 3. Guardar réplica en 'pickup'
  try {
    const refPickup = doc(db, TABLA, "pickup");
    await setDoc(
      refPickup,
      {
        titulo: nombreTiendaFinal,
        badge: badgeFinal,
        direccion: direccionFinal,
        horario: horarioFinal,
        mapsUrl: mapsUrlFinal,
        googleMapsUrl: mapsUrlFinal,
        linkMaps: mapsUrlFinal,
        telefono: telefonoFinal,
        activo: activoFinal,
        actualizadoEn: payloadFirestore.actualizadoEn,
        timestampActualizacion: ahora,
      },
      { merge: true },
    );
  } catch (errPick) {
    console.warn("Aviso al guardar en configuracion/pickup:", errPick);
  }

  return payloadFirestore;
}
