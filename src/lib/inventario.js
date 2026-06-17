import {
collection,
addDoc,
getDocs,
deleteDoc,
doc,
updateDoc
}
from "firebase/firestore";

import { db } from "./firebase";

const tabla="inventario";

/*
OBTENER
*/

export async function obtenerProductos(){

const snapshot=
await getDocs(
collection(
db,
tabla
)
);

return snapshot.docs.map(
d=>({

id:d.id,

...d.data()

})
);

}

/*
AGREGAR
*/

export async function agregarProducto(
data
){

await addDoc(

collection(
db,
tabla
),

{

activo:
data.activo
?? true,

codigoBarras:
data.codigoBarras
?? "",

nombre:
data.nombre
?? "",

precioCompra:
Number(
data.precioCompra
)
||0,

precioVenta:
Number(
data.precioVenta
)
||0,

sku:
data.sku
?? "",

stock:
Number(
data.stock
)
||0,

stockMinimo:
Number(
data.stockMinimo
)
||5,

ventas24h:
0,

creado:
new Date()

}

);

}

/*
ELIMINAR
*/

export async function eliminarProducto(
id
){

await deleteDoc(

doc(
db,
tabla,
id
)

);

}

/*
EDITAR
*/

export async function editarProducto(

id,
data

){

await updateDoc(

doc(
db,
tabla,
id
),

data

);

}