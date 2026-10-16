import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

import { db } from "./firebase";

const tabla = "inventario";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

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

async function procesarYComprimirImagen(archivo, maxDim = 1200, calidad = 0.88) {
  // Primero leemos el archivo como DataURL con FileReader (100% seguro en Electron y web)
  const dataUrlOriginal = await new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = (e) => resolve(e.target?.result || null);
    lector.onerror = () => resolve(null);
    lector.readAsDataURL(archivo);
  });

  if (!dataUrlOriginal) {
    throw new Error("No se pudo leer el archivo de imagen.");
  }

  // Intentamos optimizar con Canvas si el entorno lo soporta sin corromper el origen
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const dataUrlComprimido = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const result = canvas.toDataURL("image/jpeg", calidad);
              resolve(result);
              return;
            }
          } catch (canvasErr) {
            console.warn("Advertencia de compresión en Canvas:", canvasErr);
          }
          resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = dataUrlOriginal;
      });

      if (dataUrlComprimido) {
        return dataUrlComprimido;
      }
    } catch {
      // Usar dataUrlOriginal
    }
  }

  return dataUrlOriginal;
}

const CLOUDINARY_CONFIG = {
  cloud_name: "crdybz0f",
  api_key: "242136737982968",
  api_secret: "JjkwPFUQtcpTdioWCH9VKDwuDoM",
};

async function calcularSha1(texto) {
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    try {
      const data = new TextEncoder().encode(texto);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // continuar con fallback JS puro
    }
  }

  function rotateLeft(n, s) {
    return (n << s) | (n >>> (32 - s));
  }
  function cvtHex(val) {
    let str = "";
    for (let i = 7; i >= 0; i--) {
      str += ((val >>> (i * 4)) & 0x0f).toString(16);
    }
    return str;
  }

  let utftext = "";
  for (let n = 0; n < texto.length; n++) {
    const c = texto.charCodeAt(n);
    if (c < 128) {
      utftext += String.fromCharCode(c);
    } else if (c > 127 && c < 2048) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    } else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }
  }

  const words = [];
  for (let i = 0; i < utftext.length; i++) {
    words[i >> 2] |= (utftext.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[utftext.length >> 2] |= 0x80 << (24 - (utftext.length % 4) * 8);
  words[(((utftext.length + 8) >> 6) << 4) + 15] = utftext.length * 8;

  const W = new Array(80);
  let H0 = 0x67452301,
    H1 = 0xefcdab89,
    H2 = 0x98badcfe,
    H3 = 0x10325476,
    H4 = 0xc3d2e1f0;

  for (let i = 0; i < words.length; i += 16) {
    let A = H0,
      B = H1,
      C = H2,
      D = H3,
      E = H4;
    for (let j = 0; j < 80; j++) {
      if (j < 16) W[j] = words[i + j] || 0;
      else W[j] = rotateLeft(W[j - 3] ^ W[j - 8] ^ W[j - 14] ^ W[j - 16], 1);

      let t;
      if (j < 20)
        t = (rotateLeft(A, 5) + ((B & C) | (~B & D)) + E + W[j] + 0x5a827999) & 0xffffffff;
      else if (j < 40) t = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[j] + 0x6ed9eba1) & 0xffffffff;
      else if (j < 60)
        t = (rotateLeft(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[j] + 0x8f1bbcdc) & 0xffffffff;
      else t = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[j] + 0xca62c1d6) & 0xffffffff;

      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = t;
    }
    H0 = (H0 + A) & 0xffffffff;
    H1 = (H1 + B) & 0xffffffff;
    H2 = (H2 + C) & 0xffffffff;
    H3 = (H3 + D) & 0xffffffff;
    H4 = (H4 + E) & 0xffffffff;
  }
  return [H0, H1, H2, H3, H4].map(cvtHex).join("");
}

async function subirDirectoACloudinary(dataUri, nombreProducto) {
  const { cloud_name, api_key, api_secret } = CLOUDINARY_CONFIG;

  const safeName = String(nombreProducto ?? "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const salt = Math.floor(Math.random() * 100000);
  const publicId = `inventario/${safeName || "producto"}-${Date.now()}-${salt}`;
  const timestamp = Math.round(Date.now() / 1000);

  const stringParaFirmar = `public_id=${publicId}&timestamp=${timestamp}${api_secret}`;
  const signature = await calcularSha1(stringParaFirmar);

  const formData = new FormData();
  formData.append("file", dataUri);
  formData.append("api_key", api_key);
  formData.append("timestamp", String(timestamp));
  formData.append("public_id", publicId);
  formData.append("signature", signature);

  const endpointUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;

  // Intento 1: Fetch estándar con mode: cors
  try {
    const res = await fetch(endpointUrl, {
      method: "POST",
      mode: "cors",
      body: formData,
    });

    const datos = await res.json().catch(() => ({}));
    if (res.ok && datos.secure_url) {
      return datos.secure_url;
    }
    if (datos?.error?.message) {
      console.warn("Cloudinary fetch devolvió error:", datos.error.message);
    }
  } catch (errFetch) {
    console.warn("Fetch directo a Cloudinary no disponible, intentando XHR:", errFetch);
  }

  // Intento 2: XMLHttpRequest (más tolerante en entornos Electron y empaquetados .exe)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpointUrl, true);

    xhr.onload = () => {
      try {
        const datos = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && datos.secure_url) {
          resolve(datos.secure_url);
        } else {
          const msg = datos?.error?.message || `HTTP ${xhr.status}: ${xhr.statusText}`;
          reject(new Error(msg));
        }
      } catch (parseErr) {
        reject(new Error(`Respuesta inválida de Cloudinary: ${parseErr.message}`));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error("Error de red al conectar con Cloudinary. Verifica tu conexión a internet."),
      );
    };

    xhr.ontimeout = () => {
      reject(new Error("Tiempo de espera agotado al subir imagen a Cloudinary."));
    };

    xhr.timeout = 50000;
    xhr.send(formData);
  });
}

export async function subirImagenCloudinary(archivo, nombreProducto) {
  if (!(archivo instanceof File)) {
    throw new Error("Selecciona una imagen antes de continuar.");
  }

  if (archivo.type && !archivo.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen válida.");
  }

  if (archivo.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera el límite permitido de 15 MB.");
  }

  const dataUri = await procesarYComprimirImagen(archivo);
  if (!dataUri) {
    throw new Error("No se pudo leer ni procesar la imagen seleccionada.");
  }

  let ultimoError = null;

  // Estrategia 1: Subida directa firmada a Cloudinary (ideal para .exe y web sin saturar servidor)
  try {
    const urlSegura = await subirDirectoACloudinary(dataUri, nombreProducto);
    if (urlSegura) {
      return urlSegura;
    }
  } catch (errorDirecto) {
    console.warn("Fallo en subida directa a Cloudinary:", errorDirecto);
    ultimoError = errorDirecto;
  }

  // Estrategia 2: Fallback a servidor backend (/api/cloudinary/upload)
  const posiblesUrls = ["/api/cloudinary/upload"];
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    window.location.origin.startsWith("http")
  ) {
    posiblesUrls.unshift(`${window.location.origin}/api/cloudinary/upload`);
  }

  for (const urlApi of posiblesUrls) {
    try {
      const respuesta = await fetch(urlApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataUri,
          nombreProducto,
          nombreArchivo: generarNombreArchivoImagen(nombreProducto, archivo),
        }),
      });

      const respuestaTexto = await respuesta.text();
      let resultado = {};
      try {
        resultado = respuestaTexto ? JSON.parse(respuestaTexto) : {};
      } catch {
        resultado = {};
      }

      if (respuesta.ok && resultado.url) {
        return resultado.url;
      }
    } catch (errFallback) {
      console.warn(`Fallo en endpoint ${urlApi}:`, errFallback);
    }
  }

  throw new Error(
    `No se pudo guardar la imagen en Cloudinary: ${
      ultimoError?.message || "Verifica tu conexión y credenciales de Cloudinary."
    }`,
  );
}

export async function subirMultiplesImagenesCloudinary(archivos, nombreProducto, onProgreso) {
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return [];
  }

  const urls = [];
  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    const sufijoNombre =
      archivos.length > 1
        ? `${nombreProducto || "producto"}-${i + 1}`
        : nombreProducto || "producto";

    if (typeof onProgreso === "function") {
      onProgreso({ actual: i + 1, total: archivos.length, archivo });
    }

    const url = await subirImagenCloudinary(archivo, sufijoNombre);
    if (url) {
      urls.push(url);
    }
  }

  return urls;
}

/*
OBTENER
*/

export async function obtenerProductos() {
  try {
    const snapshot = await getDocs(collection(db, tabla));

    return snapshot.docs
      .filter((d) => d.id !== "base")
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }));
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return [];
  }
}

/*
AGREGAR
*/

export async function agregarProducto(data) {
  const rawImagenUrl = String(data.imagenUrl ?? "").trim();
  const imagenesArray =
    Array.isArray(data.imagenes) && data.imagenes.length > 0
      ? data.imagenes.map((s) => String(s || "").trim()).filter(Boolean)
      : rawImagenUrl
        ? rawImagenUrl
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

  await addDoc(
    collection(db, tabla),

    {
      activo: data.activo ?? true,

      codigoBarras: data.codigoBarras ?? "",

      nombre: data.nombre ?? "",

      imagenUrl: rawImagenUrl,

      imagenes: imagenesArray,

      categoria: data.categoria ?? "",

      precioCompra: Number(data.precioCompra) || 0,

      precioVenta: Number(data.precioVenta) || 0,

      sku: data.sku ?? "",

      stock: Number(data.stock) || 0,

      stockMinimo: Number(data.stockMinimo) || 5,

      rating: Number(data.rating) || 5,

      concentracion: data.concentracion ?? data.concentration ?? "",

      descripcion: data.descripcion ?? data.description ?? "",

      caracteristicas: Array.isArray(data.caracteristicas)
        ? data.caracteristicas
        : data.caracteristicas
          ? String(data.caracteristicas)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],

      scentNotes: Array.isArray(data.scentNotes)
        ? data.scentNotes
        : Array.isArray(data.caracteristicas)
          ? data.caracteristicas
          : data.caracteristicas
            ? String(data.caracteristicas)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],

      sizes: Array.isArray(data.sizes) ? data.sizes : [],

      ventas24h: 0,

      creado: new Date(),
    },
  );
}

/*
ELIMINAR
*/

export async function eliminarProducto(id) {
  await deleteDoc(doc(db, tabla, id));
}

/*
EDITAR
*/

export async function editarProducto(id, data) {
  const datosActualizados = { ...data };

  if (datosActualizados.imagenUrl !== undefined) {
    const rawImagenUrl = String(datosActualizados.imagenUrl ?? "").trim();
    datosActualizados.imagenUrl = rawImagenUrl;

    if (!Array.isArray(datosActualizados.imagenes) || datosActualizados.imagenes.length === 0) {
      datosActualizados.imagenes = rawImagenUrl
        ? rawImagenUrl
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    }
  }

  await updateDoc(doc(db, tabla, id), datosActualizados);
}
