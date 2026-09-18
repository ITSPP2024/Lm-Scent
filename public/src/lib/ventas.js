import { collection, addDoc, getDocs, doc, updateDoc } from "firebase/firestore";

import { db } from "./firebase";

const tabla = "ventas";

function parsearFecha(valor) {
  if (!valor) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  if (valor.seconds) return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export async function registrarVenta(data) {
  const ahora = new Date();
  return await addDoc(collection(db, tabla), {
    origen: "pos",
    canal: "pos",
    ...data,
    fecha: ahora,
    timestamp: ahora.getTime(),
    createdAt: ahora,
  });
}

export async function obtenerTodasLasVentas() {
  try {
    const snapshot = await getDocs(collection(db, tabla));
    const docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return docs.sort((a, b) => {
      const timeA = parsearFecha(a.timestamp || a.fecha || a.createdAt);
      const timeB = parsearFecha(b.timestamp || b.fecha || b.createdAt);
      return timeB - timeA;
    });
  } catch (err) {
    console.error("Error al obtener ventas:", err);
    return [];
  }
}

export async function obtenerPedidosMoviles() {
  try {
    const snapshot = await getDocs(collection(db, tabla));
    const docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Filtrar aquellos que vienen de la App Móvil
    const pedidos = docs.filter((v) => {
      return (
        v.origen === "app" ||
        v.origen === "app_movil" ||
        v.canal === "app_movil" ||
        v.canal === "app" ||
        v.esVentaApp === true ||
        Boolean(v.metodoEntrega) ||
        Boolean(v.tipoEntrega) ||
        Boolean(v.clienteMovil) ||
        (v.id && String(v.id).startsWith("LMS-"))
      );
    });

    return pedidos.sort((a, b) => {
      const timeA = parsearFecha(a.timestamp || a.fecha || a.createdAt);
      const timeB = parsearFecha(b.timestamp || b.fecha || b.createdAt);
      return timeB - timeA;
    });
  } catch (err) {
    console.error("Error al obtener pedidos móviles:", err);
    return [];
  }
}

export async function actualizarEstadoPedido(id, nuevoEstado, extras = {}) {
  const ahora = new Date();
  const datosActualizacion = {
    estado: nuevoEstado,
    estadoEntrega: nuevoEstado,
    estadoPedido: nuevoEstado,
    fechaActualizacion: ahora,
    timestampActualizacion: ahora.getTime(),
    ...extras,
  };

  if (nuevoEstado === "entregado" || nuevoEstado === "completado") {
    datosActualizacion.fechaEntrega = extras.fechaEntrega || ahora;
    datosActualizacion.timestampEntrega = ahora.getTime();
    datosActualizacion.entregado = true;
    datosActualizacion.completado = true;
  }

  return await updateDoc(doc(db, tabla, id), datosActualizacion);
}

export async function crearPedidoMovil(data) {
  const ahora = new Date();
  const esEfectivo =
    data.esEfectivo ??
    (String(data.metodoPago || "")
      .toLowerCase()
      .includes("efectivo") ||
      data.tipoPago === "efectivo" ||
      !data.esTarjeta);
  return await addDoc(collection(db, tabla), {
    origen: "app",
    canal: "app_movil",
    esVentaApp: true,
    cliente: data.cliente || "Cliente LM Scents",
    telefono: data.telefono || data.cliente?.telefono || "",
    correo: data.correo || data.cliente?.correo || "",
    direccion: data.direccion || data.cliente?.direccion || "",
    ciudad: data.ciudad || "Ciudad de México",
    codigoPostal: data.codigoPostal || "",
    metodoEntrega:
      data.metodoEntrega || (data.tipoEntrega === "tienda" ? "En Tienda" : "A Domicilio"),
    tipoEntrega: data.tipoEntrega || (data.metodoEntrega === "En Tienda" ? "tienda" : "domicilio"),
    metodoPago: data.metodoPago || (esEfectivo ? "Efectivo" : "Tarjeta"),
    tipoPago: data.tipoPago || (esEfectivo ? "efectivo" : "tarjeta"),
    esEfectivo: esEfectivo,
    esTarjeta: !esEfectivo,
    estado: data.estado || "pendiente",
    estadoEntrega: data.estado || "pendiente",
    estadoPedido: data.estado || "pendiente",
    productos: data.productos || [],
    descuento: Number(data.descuento) || 0,
    envio: Number(data.envio || data.costoEnvio) || 0,
    subtotal: Number(data.subtotal) || 0,
    total: Number(data.total) || 0,
    fecha: ahora.toISOString(),
    timestamp: ahora.getTime(),
    createdAt: ahora,
  });
}
