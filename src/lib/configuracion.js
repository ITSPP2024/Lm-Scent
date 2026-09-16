import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const DOC_ID = "general";
const COLECCION = "configuracion";
const STORAGE_KEY = "lmscents_config";

const CONFIG_DEFAULT = {
  nombreComercial: "LM Scents",
  nit: "",
  direccion: "",
  telefono: "",
  email: "",
  iva: 16,
  facturacionElectronica: false,
  resolucionFacturacion: "",
  impresora: "epson",
  copiasTicket: 1,
  anchoPapel: "80mm"
};

export async function obtenerConfiguracion() {
  try {
    const docRef = doc(db, COLECCION, DOC_ID);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = { ...CONFIG_DEFAULT, ...snapshot.data() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn("No se pudo cargar la configuración de Firestore, usando caché local:", err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return { ...CONFIG_DEFAULT, ...JSON.parse(local) };
    }
  } catch (e) {
    console.warn("Error leyendo localStorage:", e);
  }

  return { ...CONFIG_DEFAULT };
}

export async function guardarConfiguracion(nuevaConfig) {
  const data = { ...CONFIG_DEFAULT, ...nuevaConfig, actualizadoEn: new Date() };
  try {
    const docRef = doc(db, COLECCION, DOC_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    console.warn("No se pudo guardar en Firestore, guardando en local:", err);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Error escribiendo en localStorage:", e);
  }

  return data;
}
