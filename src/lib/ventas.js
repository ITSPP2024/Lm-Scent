import {
collection,
addDoc
}
from "firebase/firestore";

import {
db
}
from "./firebase";

const tabla="ventas";

export async function registrarVenta(data){

return await addDoc(
collection(
db,
tabla
),
{
...data,
fecha:new Date()
}
);

}