import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";

import { db } from "./firebase";

// =========================================================
// COLECCIONES FIREBASE
// =========================================================

const TABLA_MOVIMIENTOS = "movimientosCaja";
const TABLA_CAJAS = "cajas";
const TABLA_VENTAS = "ventas";
const TABLA_USUARIOS = "usuarios";

// =========================================================
// UTILIDADES DE FECHA
// =========================================================

function obtenerInicioDelDia() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

export function convertirFecha(fecha) {
  if (!fecha) return null;

  if (typeof fecha.toDate === "function") {
    return fecha.toDate();
  }

  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  if (typeof fecha === "object" && typeof fecha.seconds === "number") {
    return new Date(fecha.seconds * 1000);
  }

  if (typeof fecha === "number") {
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const resultado = new Date(fecha);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

function obtenerFechaVenta(venta) {
  if (venta.esVentaApp || venta.origen === "app" || venta.canal === "app_movil") {
    return (
      convertirFecha(venta.fechaEntrega) ||
      convertirFecha(venta.fechaActualizacion) ||
      convertirFecha(venta.fecha) ||
      convertirFecha(venta.timestamp) ||
      convertirFecha(venta.createdAt) ||
      null
    );
  }

  return (
    convertirFecha(venta.fecha) ||
    convertirFecha(venta.timestamp) ||
    convertirFecha(venta.createdAt) ||
    convertirFecha(venta.fechaActualizacion) ||
    null
  );
}

// =========================================================
// REGISTRAR MOVIMIENTO
// =========================================================

export async function registrarMovimiento({
  tipo,
  monto,
  descripcion,
  cajaId
}) {
  if (!tipo) {
    throw new Error("El tipo de movimiento es obligatorio.");
  }

  if (tipo !== "ingreso" && tipo !== "retiro") {
    throw new Error("El tipo de movimiento no es válido.");
  }

  const cantidad = Number(monto);

  if (isNaN(cantidad) || cantidad <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }

  // Verificar que exista una caja abierta
  let cajaActual = null;

  if (cajaId) {
    const snapshot = await getDocs(
      query(
        collection(db, TABLA_CAJAS),
        where("abierta", "==", true)
      )
    );

    const cajaEncontrada = snapshot.docs.find(d => d.id === cajaId);

    if (!cajaEncontrada) {
      throw new Error("La caja no está abierta.");
    }

    cajaActual = cajaEncontrada;
  } else {
    const snapshot = await getDocs(
      query(
        collection(db, TABLA_CAJAS),
        where("abierta", "==", true)
      )
    );

    if (snapshot.empty) {
      throw new Error("No existe una caja abierta.");
    }

    cajaActual = snapshot.docs[0];
    cajaId = cajaActual.id;
  }

  // Crear movimiento
  const movimiento = {
    tipo,
    monto: cantidad,
    descripcion: descripcion?.trim() || "",
    cajaId,
    fecha: new Date(),
    timestamp: Date.now()
  };

  const movimientoRef = await addDoc(
    collection(db, TABLA_MOVIMIENTOS),
    movimiento
  );

  return movimientoRef;
}

// =========================================================
// OBTENER CAJA ABIERTA
// =========================================================

export async function obtenerCajaAbierta() {
  const snapshot = await getDocs(
    query(
      collection(db, TABLA_CAJAS),
      where("abierta", "==", true)
    )
  );

  if (snapshot.empty) {
    return null;
  }

  const documento = snapshot.docs[0];

  return {
    id: documento.id,
    ...documento.data()
  };
}

// =========================================================
// VALIDAR AUTORIZACIÓN PARA CERRAR CAJA
// =========================================================

export async function validarUsuarioCaja(usuario, password) {
  const identificador = String(usuario || "").trim().toLowerCase();
  const clave = String(password || "");

  if (!identificador || !clave) {
    return null;
  }

  const documentoBase = await getDoc(
    doc(db, TABLA_USUARIOS, "base")
  );

  const documentos = documentoBase.exists()
    ? [documentoBase]
    : (await getDocs(collection(db, TABLA_USUARIOS))).docs;

  const encontrado = documentos
    .map(documento => ({
      id: documento.id,
      ...documento.data()
    }))
    .find(datos => {
      const nombre = String(datos.nombre || "").trim().toLowerCase();
      const correo = String(datos.correo || "").trim().toLowerCase();
      const usuarioGuardado = String(datos.usuario || "").trim().toLowerCase();

      return (
        (nombre === identificador ||
          correo === identificador ||
          usuarioGuardado === identificador) &&
        String(datos.password || "") === clave
      );
    });

  if (!encontrado) {
    return null;
  }

  return {
    id: encontrado.id,
    nombre: encontrado.nombre || encontrado.correo || encontrado.id,
    rol: encontrado.rol || ""
  };
}

// =========================================================
// OBTENER MOVIMIENTOS DEL DÍA O TURNO
// =========================================================

export async function obtenerMovimientosHoy(cajaId = null, fechaApertura = null) {
  const inicioFiltro = fechaApertura
    ? (convertirFecha(fechaApertura) || obtenerInicioDelDia())
    : obtenerInicioDelDia();

  try {
    const snapshot = await getDocs(collection(db, TABLA_MOVIMIENTOS));
    const movimientos = snapshot.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(m => {
        if (cajaId && m.cajaId && m.cajaId !== cajaId) return false;
        const fechaM = convertirFecha(m.fecha) || convertirFecha(m.timestamp);
        if (!fechaM) return false;
        return fechaM >= inicioFiltro;
      });

    return movimientos.sort((a, b) => {
      const timeA = (convertirFecha(a.fecha) || convertirFecha(a.timestamp))?.getTime() || 0;
      const timeB = (convertirFecha(b.fecha) || convertirFecha(b.timestamp))?.getTime() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error al obtener movimientos de caja:", error);
    return [];
  }
}

// =========================================================
// OBTENER VENTAS DEL DÍA / TURNO (POS + APP MÓVIL EN EFECTIVO)
// =========================================================

export async function obtenerVentasHoy(cajaId = null, fechaApertura = null) {
  const inicioFiltro = fechaApertura
    ? (convertirFecha(fechaApertura) || obtenerInicioDelDia())
    : obtenerInicioDelDia();

  try {
    const snapshot = await getDocs(collection(db, TABLA_VENTAS));
    const docs = snapshot.docs
      .filter(d => d.id !== "base")
      .map(d => ({
        id: d.id,
        ...d.data()
      }));

    // Filtrar ventas que impactan la caja en EFECTIVO
    const ventasEfectivo = docs.filter(v => {
      const fecha = obtenerFechaVenta(v);
      if (!fecha || fecha < inicioFiltro) return false;

      const esApp = (
        v.origen === "app" ||
        v.origen === "app_movil" ||
        v.canal === "app_movil" ||
        v.canal === "app" ||
        v.esVentaApp === true ||
        Boolean(v.metodoEntrega) ||
        Boolean(v.clienteMovil)
      );

      // Si es de la App Móvil:
      if (esApp) {
        // 1. Debe estar ENTREGADO
        const estado = String(v.estado || v.estadoEntrega || v.estadoPedido || "").toLowerCase();
        const esEntregado = (
          estado === "entregado" ||
          estado === "completado" ||
          estado === "despachado" ||
          v.entregado === true ||
          v.completado === true
        );

        if (!esEntregado) return false;

        // 2. Debe haber sido pagado en EFECTIVO (contra entrega o en efectivo)
        const esEfectivo = (
          v.esEfectivo === true ||
          String(v.metodoPago || "").toLowerCase().includes("efectivo") ||
          String(v.tipoPago || "").toLowerCase().includes("efectivo") ||
          (!v.esTarjeta && String(v.metodoPago || "").toLowerCase() !== "tarjeta")
        );

        return esEfectivo;
      }

      // Si es venta directa del POS de la tienda:
      // Se considera efectivo a menos que explícitamente se indique que es sólo tarjeta
      const esTarjeta = (
        v.esTarjeta === true ||
        (String(v.metodoPago || "").toLowerCase() === "tarjeta" && v.esEfectivo !== true)
      );

      return !esTarjeta;
    });

    return ventasEfectivo.sort((a, b) => {
      const fechaA = obtenerFechaVenta(a)?.getTime() || 0;
      const fechaB = obtenerFechaVenta(b)?.getTime() || 0;
      return fechaB - fechaA;
    });
  } catch (error) {
    console.error("Error al obtener ventas de caja:", error);
    return [];
  }
}

// =========================================================
// OBTENER ACTIVIDAD COMPLETA DE CAJA
// =========================================================

export async function obtenerActividadCaja(cajaId = null) {
  const caja = await obtenerCajaAbierta();
  const idCaja = cajaId || caja?.id || null;
  const fechaApertura = caja?.fecha || null;

  const [movimientos, ventas] = await Promise.all([
    obtenerMovimientosHoy(idCaja, fechaApertura),
    obtenerVentasHoy(idCaja, fechaApertura)
  ]);

  return {
    caja,
    movimientos,
    ventas
  };
}

// =========================================================
// OBTENER RESUMEN COMPLETO DE CAJA
// =========================================================

export async function obtenerResumenCaja() {
  const actividad = await obtenerActividadCaja();

  const caja = actividad.caja;
  const movimientos = actividad.movimientos;
  const ventas = actividad.ventas;

  // -------------------------------------------------------
  // FONDO INICIAL
  // -------------------------------------------------------
  const fondoInicial = Number(caja?.fondoInicial || 0);

  // -------------------------------------------------------
  // TOTAL DE VENTAS EN EFECTIVO (POS + APP MÓVIL ENTREGADOS)
  // -------------------------------------------------------
  const totalVentas = ventas.reduce((total, venta) => {
    return total + (Number(venta.total) || 0);
  }, 0);

  // -------------------------------------------------------
  // TOTAL DE INGRESOS
  // -------------------------------------------------------
  const totalIngresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((total, m) => total + (Number(m.monto) || 0), 0);

  // -------------------------------------------------------
  // TOTAL DE RETIROS
  // -------------------------------------------------------
  const totalRetiros = movimientos
    .filter(m => m.tipo === "retiro")
    .reduce((total, m) => total + (Number(m.monto) || 0), 0);

  // -------------------------------------------------------
  // TOTAL DE ENTRADAS
  // -------------------------------------------------------
  const totalEntradas = fondoInicial + totalVentas + totalIngresos;

  // -------------------------------------------------------
  // EFECTIVO ESPERADO EN CAJA
  // -------------------------------------------------------
  const efectivoEsperado = fondoInicial + totalVentas + totalIngresos - totalRetiros;

  return {
    caja,
    movimientos,
    ventas,
    fondoInicial,
    totalVentas,
    totalIngresos,
    totalRetiros,
    totalEntradas,
    efectivoEsperado
  };
}

// =========================================================
// ABRIR CAJA
// =========================================================

export async function abrirCaja(
  fondoInicial,
  notas = "",
  usuarioApertura = "",
  rolApertura = ""
) {
  const fondo = Number(fondoInicial) || 0;
  const ahora = new Date();

  const docRef = await addDoc(collection(db, TABLA_CAJAS), {
    fecha: ahora,
    timestamp: ahora.getTime(),
    fondoInicial: fondo,
    efectivoEsperado: fondo,
    efectivoReal: null,
    diferencia: null,
    notas: notas || "",
    usuarioApertura: usuarioApertura || "",
    rolApertura: rolApertura || "",
    abierta: true,
    totalVentas: 0,
    totalIngresos: 0,
    totalRetiros: 0
  });

  return docRef.id;
}

// =========================================================
// GESTIÓN DE SESIÓN LOCAL (PERSISTENCIA AL RECARGAR)
// =========================================================

const CLAVE_SESION = "lm_scents_sesion_activa";
const CLAVE_CARRITO = "lm_scents_carrito_temp";

export function guardarSesionActiva(usuario) {
  if (!usuario) return;
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol || "",
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error("Error al guardar sesión en localStorage:", e);
  }
}

export function obtenerSesionActiva() {
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function cerrarSesionLocal() {
  try {
    localStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_CARRITO);
  } catch (e) {
    console.error("Error al cerrar sesión local:", e);
  }
}

export function guardarCarritoLocal(carrito) {
  try {
    if (!carrito || !carrito.length) {
      localStorage.removeItem(CLAVE_CARRITO);
    } else {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    }
  } catch (e) {}
}

export function obtenerCarritoLocal() {
  try {
    const raw = localStorage.getItem(CLAVE_CARRITO);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// =========================================================
// CERRAR CAJA / CORTE FINAL
// =========================================================

export async function cerrarCaja({
  cajaId,
  efectivoReal,
  denominaciones = {},
  usuarioCierre = "",
  rolCierre = ""
}) {
  if (!cajaId) {
    throw new Error("No se proporcionó el ID de la caja a cerrar.");
  }

  const resumen = await obtenerResumenCaja();
  const esperado = Number(resumen.efectivoEsperado) || 0;
  const real = Number(efectivoReal) || 0;
  const diferencia = real - esperado;
  const ahora = new Date();

  const datosCierre = {
    abierta: false,
    fechaCierre: ahora,
    timestampCierre: ahora.getTime(),
    efectivoEsperado: esperado,
    efectivoReal: real,
    diferencia: diferencia,
    totalVentas: Number(resumen.totalVentas) || 0,
    totalIngresos: Number(resumen.totalIngresos) || 0,
    totalRetiros: Number(resumen.totalRetiros) || 0,
    denominaciones: denominaciones || {},
    usuarioCierre: usuarioCierre || "",
    rolCierre: rolCierre || ""
  };

  await updateDoc(doc(db, TABLA_CAJAS, cajaId), datosCierre);

  // Limpiar sesión local al cerrar la caja
  cerrarSesionLocal();

  return {
    id: cajaId,
    ...datosCierre
  };
}

// =========================================================
// ACTUALIZAR EFECTIVO ESPERADO
// =========================================================

export async function actualizarEfectivoEsperado(cajaId, incremento) {
  if (!cajaId) {
    throw new Error("No se proporcionó el ID de la caja.");
  }

  const cantidad = Number(incremento);
  if (isNaN(cantidad)) {
    throw new Error("El incremento debe ser un número válido.");
  }

  const resumen = await obtenerResumenCaja();

  await updateDoc(doc(db, TABLA_CAJAS, cajaId), {
    efectivoEsperado: resumen.efectivoEsperado,
    totalVentas: resumen.totalVentas,
    totalIngresos: resumen.totalIngresos,
    totalRetiros: resumen.totalRetiros
  });

  return resumen.efectivoEsperado;
}
