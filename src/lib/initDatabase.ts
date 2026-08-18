/*
import {
doc,
setDoc,
serverTimestamp
} from "firebase/firestore";

import {
db
} from "./firebase";

export async function initDatabase(){

await Promise.all([

setDoc(
doc(db,"configuracion","general"),
{
nombreTienda:"SCENT LM",
taxId:"",
direccion:"",
telefono:"",
correo:""
}
),

setDoc(
doc(db,"cajas","base"),
{
fecha:serverTimestamp(),
fondoInicial:0,
efectivoEsperado:0,
efectivoReal:0,
diferencia:0,
notas:"",
abierta:false
}
),

setDoc(
doc(db,"productos","base"),
{
nombre:"",
sku:"",
codigoBarras:"",
precioCompra:0,
precioVenta:0,
stock:0,
stockMinimo:5,
activo:true
}
),

setDoc(
doc(db,"ventas","base"),
{
folio:"",
fecha:serverTimestamp(),
subtotal:0,
iva:0,
total:0,
metodoPago:"",
detalles:[]
}
),

setDoc(
doc(db,"clientes","base"),
{
nombre:"",
telefono:"",
correo:""
}
),

setDoc(
doc(db,"usuarios","base"),
{
nombre:"",
correo:"",
password:"",
rol:"ADMIN"
}
),

setDoc(
doc(db,"movimientosCaja","base"),
{
fecha:serverTimestamp(),
tipo:"",
descripcion:"",
monto:0,
notas:""
}
)

]);

console.log(
"BASE CREADA"
);

}
*/