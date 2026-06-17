import {
collection,
addDoc,
serverTimestamp
} from "firebase/firestore";

import { db } from "./firebase";

export async function abrirCaja(
fondoInicial:number,
notas:string
){

const docRef =
await addDoc(
collection(db,"cajas"),
{

fecha:
serverTimestamp(),

fondoInicial,

efectivoEsperado:
fondoInicial,

efectivoReal:
null,

diferencia:
null,

notas,

abierta:true

}
);

return docRef.id;

}