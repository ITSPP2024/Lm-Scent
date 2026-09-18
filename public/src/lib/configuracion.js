import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";

import { db } from "./firebase";

const DOC_ID = "principal";
const TABLA = "configuracion";

export async function obtenerConfiguracion() {
  const ref = doc(db, TABLA, DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return {
    nombreComercial: "Scent LM Premium Boutique",
    nit: "",
    direccion: "",
    telefono: "",
    email: "",
    iva: 16,
    facturacionElectronica: false,
    resolucionFacturacion: "",
    anchoPapel: "80mm",
    copiasTicket: 1,
  };
}

export async function guardarConfiguracion(data) {
  const ref = doc(db, TABLA, DOC_ID);
  await setDoc(ref, data, { merge: true });
}
