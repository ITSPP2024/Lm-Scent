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


const tabla = "inventario";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function generarNombreArchivoImagen(nombreProducto, archivo) {

    const extension =
        String(archivo?.name || "")
            .split(".")
            .pop()
            ?.toLowerCase() || "jpg";

    const nombreSeguro =
        String(nombreProducto || "producto")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase() || "producto";

    return `${nombreSeguro}.${extension}`;

}

export async function subirImagenCloudinary(
    archivo,
    nombreProducto
) {

    if (!(archivo instanceof File)) {
        throw new Error("Selecciona una imagen antes de continuar.");
    }

    if (!archivo.type.startsWith("image/")) {
        throw new Error("El archivo seleccionado no es una imagen válida.");
    }

    if (archivo.size > MAX_IMAGE_BYTES) {
        throw new Error("La imagen no puede superar los 5 MB.");
    }

    const dataUri = await new Promise(
        (resolve, reject) => {
            const lector = new FileReader();

            lector.onload = () => resolve(lector.result);
            lector.onerror = () =>
                reject(
                    new Error(
                        "No se pudo leer la imagen seleccionada."
                    )
                );

            lector.readAsDataURL(archivo);
        }
    );

    const respuesta =
        await fetch(
            "/api/cloudinary/upload",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    dataUri,
                    nombreProducto,
                    nombreArchivo: generarNombreArchivoImagen(
                        nombreProducto,
                        archivo
                    )
                })
            }
        );

    const respuestaTexto =
        await respuesta.text();

    let resultado = {};

    try {
        resultado =
            respuestaTexto
                ? JSON.parse(respuestaTexto)
                : {};
    }
    catch {
        resultado = {};
    }

    if (!respuesta.ok || !resultado.url) {
        throw new Error(
            resultado.message ||
            `Error HTTP ${respuesta.status} al subir la imagen a Cloudinary.`
        );
    }

    return resultado.url;

}


/*
OBTENER
*/


export async function obtenerProductos(){


    const snapshot =
        await getDocs(
            collection(
                db,
                tabla
            )
        );


    return snapshot.docs.map(
        d => ({


            id: d.id,


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

            imagenUrl:
                data.imagenUrl
                ?? "",


            categoria:
                data.categoria
                ?? "",


            precioCompra:
                Number(
                    data.precioCompra
                )
                || 0,


            precioVenta:
                Number(
                    data.precioVenta
                )
                || 0,


            sku:
                data.sku
                ?? "",


            stock:
                Number(
                    data.stock
                )
                || 0,


            stockMinimo:
                Number(
                    data.stockMinimo
                )
                || 5,


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