import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc
} from "firebase/firestore";

import { db } from "../lib/firebase.js";

const TABLA_MOVIMIENTOS = "movimientosCaja";
const TABLA_CAJAS = "cajas";

export async function registrarMovimiento({ tipo, monto, descripcion, cajaId }) {
  return await addDoc(collection(db, TABLA_MOVIMIENTOS), {
    tipo,
    monto: Number(monto),
    descripcion: descripcion || "",
    cajaId: cajaId || null,
    fecha: new Date()
  });
}

export async function obtenerMovimientosHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const snapshot = await getDocs(
    query(
      collection(db, TABLA_MOVIMIENTOS),
      where("fecha", ">=", Timestamp.fromDate(hoy)),
      orderBy("fecha", "desc")
    )
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function obtenerCajaAbierta() {
  const snapshot = await getDocs(
    query(
      collection(db, TABLA_CAJAS),
      where("abierta", "==", true)
    )
  );
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function cerrarCaja({ cajaId, efectivoReal, denominaciones, notas }) {
  const cajaRef = doc(db, TABLA_CAJAS, cajaId);
  const cajaSnap = await getDocs(
    query(collection(db, TABLA_CAJAS), where("abierta", "==", true))
  );

  const cajaDoc = cajaSnap.docs.find(d => d.id === cajaId);
  const efectivoEsperado = cajaDoc?.data()?.efectivoEsperado || 0;
  const diferencia = efectivoReal - efectivoEsperado;

  await updateDoc(cajaRef, {
    abierta: false,
    efectivoReal: Number(efectivoReal),
    diferencia,
    denominaciones: denominaciones || {},
    notasCierre: notas || "",
    fechaCierre: new Date()
  });

  return { efectivoEsperado, diferencia };
}

export async function actualizarEfectivoEsperado(cajaId, incremento) {
  const cajaRef = doc(db, TABLA_CAJAS, cajaId);
  const cajaSnap = await getDocs(
    query(collection(db, TABLA_CAJAS), where("abierta", "==", true))
  );
  const cajaDoc = cajaSnap.docs.find(d => d.id === cajaId);
  if (!cajaDoc) return;
  const actual = cajaDoc.data().efectivoEsperado || 0;
  await updateDoc(cajaRef, {
    efectivoEsperado: actual + Number(incremento)
  });
}
