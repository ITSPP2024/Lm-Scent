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
  updateDoc,
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
// GESTIÓN DE SESIÓN DE USUARIO
// =========================================================

export function guardarSesionActiva(usuario) {
  if (!usuario) return null;
  const sesion = {
    id: usuario.id || "",
    nombre: usuario.nombre || usuario.usuario || "Usuario",
    rol: usuario.rol || "VENDEDOR",
    correo: usuario.correo || "",
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem("lm_sesion_activa", JSON.stringify(sesion));
    sessionStorage.setItem("lm_sesion_activa", JSON.stringify(sesion));
  } catch (e) {
    console.warn("No se pudo almacenar la sesión:", e);
  }
  return sesion;
}

export function obtenerSesionActiva() {
  try {
    const raw =
      sessionStorage.getItem("lm_sesion_activa") || localStorage.getItem("lm_sesion_activa");
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && (data.nombre || data.id)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  try {
    localStorage.removeItem("lm_sesion_activa");
    sessionStorage.removeItem("lm_sesion_activa");
  } catch (e) {
    console.warn("Error al cerrar sesión:", e);
  }
}

export function verificarSesionOVolverAWelcome() {
  const sesion = obtenerSesionActiva();
  if (!sesion) {
    console.info("Sin sesión activa detectada.");
    if (typeof window !== "undefined") {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "NAVIGATE_TO", path: "/" }, "*");
        }
      } catch (e) {
        /* ignore cross-origin */
      }
    }
    return null;
  }
  return sesion;
}

// =========================================================
// REGISTRAR MOVIMIENTO
// =========================================================

export async function registrarMovimiento({ tipo, monto, descripcion, cajaId, usuario = "" }) {
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
      query(collection(db, TABLA_CAJAS), where("abierta", "==", true)),
    );

    const cajaEncontrada = snapshot.docs.find((d) => d.id === cajaId);

    if (!cajaEncontrada) {
      throw new Error("La caja no está abierta.");
    }

    cajaActual = cajaEncontrada;
  } else {
    cajaActual = await obtenerCajaAbierta();

    if (!cajaActual) {
      throw new Error("No existe una caja abierta.");
    }

    cajaId = cajaActual.id;
  }

  const ahora = new Date();

  // Crear movimiento
  const movimiento = {
    tipo,
    monto: cantidad,
    descripcion: descripcion?.trim() || "",
    cajaId,
    usuario: usuario || "",
    fecha: ahora,
    timestamp: ahora.getTime(),
  };

  const movimientoRef = await addDoc(collection(db, TABLA_MOVIMIENTOS), movimiento);

  return movimientoRef;
}

// =========================================================
// OBTENER CAJA ABIERTA
// =========================================================

export async function obtenerCajaAbierta() {
  try {
    const snapshot = await getDocs(
      query(collection(db, TABLA_CAJAS), where("abierta", "==", true)),
    );

    if (snapshot.empty) {
      return null;
    }

    // Ordenar de más reciente a más antigua para tomar estrictamente el turno actual
    const cajas = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    cajas.sort((a, b) => {
      const timeA = convertirFecha(a.fecha) || a.timestamp || 0;
      const timeB = convertirFecha(b.fecha) || b.timestamp || 0;
      const msA = timeA instanceof Date ? timeA.getTime() : Number(timeA) || 0;
      const msB = timeB instanceof Date ? timeB.getTime() : Number(timeB) || 0;
      return msB - msA;
    });

    const masReciente = cajas[0];

    // Si por inconsistencias previas quedaron múltiples abiertas, cerrar en segundo plano las antiguas
    if (cajas.length > 1) {
      for (let i = 1; i < cajas.length; i++) {
        updateDoc(doc(db, TABLA_CAJAS, cajas[i].id), {
          abierta: false,
          motivoCierre: "Cierre automático de caja duplicada anterior",
        }).catch(() => {});
      }
    }

    return masReciente;
  } catch (error) {
    console.error("Error al obtener caja abierta:", error);
    return null;
  }
}

// =========================================================
// VALIDAR AUTORIZACIÓN PARA CAJA
// =========================================================

export async function validarUsuarioCaja(usuario, password) {
  const identificador = String(usuario || "")
    .trim()
    .toLowerCase();
  const clave = String(password || "");

  if (!identificador || !clave) {
    return null;
  }

  const documentoBase = await getDoc(doc(db, TABLA_USUARIOS, "base"));

  const documentos = documentoBase.exists()
    ? [documentoBase]
    : (await getDocs(collection(db, TABLA_USUARIOS))).docs;

  const encontrado = documentos
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .find((datos) => {
      const nombre = String(datos.nombre || "")
        .trim()
        .toLowerCase();
      const correo = String(datos.correo || "")
        .trim()
        .toLowerCase();
      const usuarioGuardado = String(datos.usuario || "")
        .trim()
        .toLowerCase();

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
    rol: encontrado.rol || "",
  };
}

// =========================================================
// OBTENER MOVIMIENTOS DEL DÍA O TURNO
// =========================================================

export async function obtenerMovimientosHoy(cajaId = null, fechaApertura = null) {
  let inicioFiltro = null;
  if (fechaApertura) {
    inicioFiltro = convertirFecha(fechaApertura);
  }

  try {
    const snapshot = await getDocs(collection(db, TABLA_MOVIMIENTOS));
    const movimientos = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      .filter((m) => {
        // Aislamiento por turno: Si se especificó cajaId, debe pertenecer a esta caja
        if (cajaId) {
          if (m.cajaId) {
            return m.cajaId === cajaId;
          }
          // Si no tiene cajaId, sólo incluir si fue registrado después de abrir esta caja
          if (!inicioFiltro) return false;
          const fechaM = convertirFecha(m.fecha) || convertirFecha(m.timestamp);
          return fechaM && fechaM >= inicioFiltro;
        }

        // Si se especificó fechaApertura pero no cajaId, filtrar desde esa fecha
        if (inicioFiltro) {
          const fechaM = convertirFecha(m.fecha) || convertirFecha(m.timestamp);
          return fechaM && fechaM >= inicioFiltro;
        }

        // Si no se proporcionó cajaId ni fechaApertura (historial general de caja), incluir todos los movimientos
        return true;
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
  let inicioFiltro = null;
  if (fechaApertura) {
    inicioFiltro = convertirFecha(fechaApertura);
  }

  try {
    const snapshot = await getDocs(collection(db, TABLA_VENTAS));
    const docs = snapshot.docs
      .filter((d) => d.id !== "base")
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }));

    // Filtrar ventas que impactan la caja en EFECTIVO en este corte
    const ventasEfectivo = docs.filter((v) => {
      // Aislamiento estricto por corte:
      if (cajaId) {
        if (v.cajaId) {
          // Si la venta tiene cajaId asignado, debe coincidir exactamente con este corte
          if (v.cajaId !== cajaId) return false;
        } else {
          // Si no tiene cajaId (pedidos app o ventas anteriores sin id de caja),
          // únicamente entran si la fecha es estrictamente igual o posterior a la apertura de este turno
          if (!inicioFiltro) return false;
          const fecha = obtenerFechaVenta(v);
          if (!fecha || fecha < inicioFiltro) return false;
        }
      } else if (inicioFiltro) {
        const fecha = obtenerFechaVenta(v);
        if (!fecha || fecha < inicioFiltro) return false;
      }

      const esApp =
        v.origen === "app" ||
        v.origen === "app_movil" ||
        v.canal === "app_movil" ||
        v.canal === "app" ||
        v.esVentaApp === true ||
        Boolean(v.metodoEntrega) ||
        Boolean(v.clienteMovil);

      // Si es de la App Móvil:
      if (esApp) {
        const estado = String(v.estado || v.estadoEntrega || v.estadoPedido || "").toLowerCase();
        const esEntregado =
          estado === "entregado" ||
          estado === "completado" ||
          estado === "despachado" ||
          v.entregado === true ||
          v.completado === true;

        if (!esEntregado) return false;

        const esEfectivo =
          v.esEfectivo === true ||
          String(v.metodoPago || "")
            .toLowerCase()
            .includes("efectivo") ||
          String(v.tipoPago || "")
            .toLowerCase()
            .includes("efectivo") ||
          (!v.esTarjeta && String(v.metodoPago || "").toLowerCase() !== "tarjeta");

        return esEfectivo;
      }

      // Si es venta directa del POS de la tienda:
      const esTarjeta =
        v.esTarjeta === true ||
        (String(v.metodoPago || "").toLowerCase() === "tarjeta" && v.esEfectivo !== true);

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
  let caja = null;
  if (cajaId) {
    const docSnap = await getDoc(doc(db, TABLA_CAJAS, cajaId));
    if (docSnap.exists()) {
      caja = { id: docSnap.id, ...docSnap.data() };
    }
  }
  if (!caja) {
    caja = await obtenerCajaAbierta();
  }

  const idCaja = caja?.id || cajaId || null;
  const fechaApertura = caja?.fecha || caja?.timestamp || null;

  const [movimientos, ventas] = await Promise.all([
    obtenerMovimientosHoy(idCaja, fechaApertura),
    obtenerVentasHoy(idCaja, fechaApertura),
  ]);

  return {
    caja,
    movimientos,
    ventas,
  };
}

// =========================================================
// OBTENER RESUMEN COMPLETO DE CAJA
// =========================================================

export async function obtenerResumenCaja(cajaId = null) {
  const actividad = await obtenerActividadCaja(cajaId);

  const caja = actividad.caja;
  const movimientos = actividad.movimientos;
  const ventas = actividad.ventas;

  // -------------------------------------------------------
  // FONDO INICIAL (Estrictamente de esta caja/turno)
  // -------------------------------------------------------
  const fondoInicial = Number(caja?.fondoInicial || 0);

  // -------------------------------------------------------
  // TOTAL DE VENTAS EN EFECTIVO
  // -------------------------------------------------------
  const totalVentas = ventas.reduce((total, venta) => {
    return total + (Number(venta.total) || 0);
  }, 0);

  // -------------------------------------------------------
  // TOTAL DE INGRESOS
  // -------------------------------------------------------
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((total, m) => total + (Number(m.monto) || 0), 0);

  // -------------------------------------------------------
  // TOTAL DE RETIROS
  // -------------------------------------------------------
  const totalRetiros = movimientos
    .filter((m) => m.tipo === "retiro")
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
    efectivoEsperado,
  };
}

// =========================================================
// ABRIR CAJA
// =========================================================

export async function abrirCaja(fondoInicial, notas = "", usuarioApertura = "", rolApertura = "") {
  const fondo = Number(fondoInicial) || 0;
  const ahora = new Date();

  // 1. Cerrar cualquier caja abierta previa para evitar mezcla o arrastre de montos
  try {
    const previasSnapshot = await getDocs(
      query(collection(db, TABLA_CAJAS), where("abierta", "==", true)),
    );
    for (const d of previasSnapshot.docs) {
      await updateDoc(doc(db, TABLA_CAJAS, d.id), {
        abierta: false,
        fechaCierre: ahora,
        timestampCierre: ahora.getTime(),
        motivoCierre: "Cierre automático al abrir un nuevo turno",
      });
    }
  } catch (err) {
    console.warn("Advertencia al cerrar cajas previas abiertas:", err);
  }

  // 2. Crear el nuevo documento de apertura de caja
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
    totalRetiros: 0,
  });

  return docRef.id;
}

// =========================================================
// CERRAR CAJA / CORTE FINAL
// =========================================================

export async function cerrarCaja({
  cajaId,
  efectivoReal,
  denominaciones = {},
  usuarioCierre = "",
  rolCierre = "",
}) {
  if (!cajaId) {
    throw new Error("No se proporcionó el ID de la caja a cerrar.");
  }

  const resumen = await obtenerResumenCaja(cajaId);
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
    rolCierre: rolCierre || "",
  };

  await updateDoc(doc(db, TABLA_CAJAS, cajaId), datosCierre);

  return {
    id: cajaId,
    ...datosCierre,
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

  const resumen = await obtenerResumenCaja(cajaId);

  await updateDoc(doc(db, TABLA_CAJAS, cajaId), {
    efectivoEsperado: resumen.efectivoEsperado,
    totalVentas: resumen.totalVentas,
    totalIngresos: resumen.totalIngresos,
    totalRetiros: resumen.totalRetiros,
  });

  return resumen.efectivoEsperado;
}
