import {
collection,
addDoc,
serverTimestamp
} from "firebase/firestore";

import { db } from "./firebase";

export async function abrirCaja(
  fondoInicial: number,
  notas: string = "",
  usuarioApertura: string = "",
  rolApertura: string = ""
) {
  const docRef = await addDoc(
    collection(db, "cajas"),
    {
      fecha: serverTimestamp(),
      timestamp: Date.now(),
      fondoInicial,
      efectivoEsperado: fondoInicial,
      efectivoReal: null,
      diferencia: null,
      notas,
      usuarioApertura,
      rolApertura,
      abierta: true,
      totalVentas: 0,
      totalIngresos: 0,
      totalRetiros: 0
    }
  );

  return docRef.id;
}