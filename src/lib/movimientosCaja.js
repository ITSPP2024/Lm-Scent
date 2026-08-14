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
// OBTENER INICIO DEL DÍA
// =========================================================

function obtenerInicioDelDia() {

  const hoy = new Date();

  hoy.setHours(0, 0, 0, 0);

  return Timestamp.fromDate(hoy);
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
    throw new Error(
      "El tipo de movimiento es obligatorio."
    );
  }

  if (
    tipo !== "ingreso" &&
    tipo !== "retiro"
  ) {
    throw new Error(
      "El tipo de movimiento no es válido."
    );
  }

  const cantidad = Number(monto);

  if (
    isNaN(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor a cero."
    );
  }


  // Verificar que exista una caja abierta

  let cajaActual = null;

  if (cajaId) {

    const cajaRef =
      doc(
        db,
        TABLA_CAJAS,
        cajaId
      );

    const snapshot =
      await getDocs(
        query(
          collection(db, TABLA_CAJAS),
          where("abierta", "==", true)
        )
      );

    const cajaEncontrada =
      snapshot.docs.find(
        d => d.id === cajaId
      );

    if (!cajaEncontrada) {
      throw new Error(
        "La caja no está abierta."
      );
    }

    cajaActual = cajaEncontrada;

  } else {

    const snapshot =
      await getDocs(
        query(
          collection(db, TABLA_CAJAS),
          where("abierta", "==", true)
        )
      );

    if (snapshot.empty) {
      throw new Error(
        "No existe una caja abierta."
      );
    }

    cajaActual =
      snapshot.docs[0];

    cajaId =
      cajaActual.id;
  }


  // Crear movimiento

  const movimiento = {

    tipo,

    monto:
      cantidad,

    descripcion:
      descripcion?.trim() || "",

    cajaId,

    fecha:
      Timestamp.now()

  };


  const movimientoRef =
    await addDoc(
      collection(
        db,
        TABLA_MOVIMIENTOS
      ),
      movimiento
    );


  return movimientoRef;
}


// =========================================================
// OBTENER CAJA ABIERTA
// =========================================================

export async function obtenerCajaAbierta() {

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          TABLA_CAJAS
        ),

        where(
          "abierta",
          "==",
          true
        )
      )
    );


  if (snapshot.empty) {
    return null;
  }


  const documento =
    snapshot.docs[0];


  return {

    id:
      documento.id,

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

  // El documento mostrado en Firestore se llama "base". Leerlo directamente
  // evita que una regla de Firestore bloquee una lectura de toda la colección.
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
// OBTENER MOVIMIENTOS DEL DÍA
// =========================================================

export async function obtenerMovimientosHoy(
  cajaId = null
) {

  const inicioDia =
    obtenerInicioDelDia();


  // Se consulta únicamente por fecha, que no requiere índice compuesto.
  // Si se solicita una caja concreta, se filtra en memoria después.
  const consulta = query(
    collection(db, TABLA_MOVIMIENTOS),
    where("fecha", ">=", inicioDia),
    orderBy("fecha", "desc")
  );


  const snapshot =
    await getDocs(
      consulta
    );


  const movimientos = snapshot.docs.map(
    d => ({
      id:
        d.id,
      ...d.data()
    })
  );

  return cajaId
    ? movimientos.filter(movimiento => movimiento.cajaId === cajaId)
    : movimientos;
}


// =========================================================
// OBTENER VENTAS DEL DÍA
// =========================================================

export async function obtenerVentasHoy() {

  const inicioDia =
    obtenerInicioDelDia();


  const consulta =
    query(

      collection(
        db,
        TABLA_VENTAS
      ),

      where(
        "fecha",
        ">=",
        inicioDia
      ),

      orderBy(
        "fecha",
        "desc"
      )

    );


  const snapshot =
    await getDocs(
      consulta
    );


  return snapshot.docs.map(
    d => ({

      id:
        d.id,

      ...d.data()

    })
  );
}


// =========================================================
// OBTENER ACTIVIDAD COMPLETA DE CAJA
// =========================================================

export async function obtenerActividadCaja(
  cajaId = null
) {

  const caja =
    await obtenerCajaAbierta();


  const idCaja =
    cajaId ||
    caja?.id ||
    null;


  const [
    movimientos,
    ventas
  ] = await Promise.all([

    obtenerMovimientosHoy(
      idCaja
    ),

    obtenerVentasHoy()

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

  const actividad =
    await obtenerActividadCaja();


  const caja =
    actividad.caja;

  const movimientos =
    actividad.movimientos;

  const ventas =
    actividad.ventas;


  // -------------------------------------------------------
  // FONDO INICIAL
  // -------------------------------------------------------

  const fondoInicial =
    Number(
      caja?.fondoInicial || 0
    );


  // -------------------------------------------------------
  // TOTAL DE VENTAS
  // -------------------------------------------------------

  const totalVentas =
    ventas.reduce(

      (total, venta) => {

        return (
          total +
          Number(
            venta.total || 0
          )
        );

      },

      0

    );


  // -------------------------------------------------------
  // TOTAL DE INGRESOS
  // -------------------------------------------------------

  const totalIngresos =
    movimientos
      .filter(
        movimiento =>
          movimiento.tipo ===
          "ingreso"
      )
      .reduce(

        (total, movimiento) => {

          return (
            total +
            Number(
              movimiento.monto || 0
            )
          );

        },

        0

      );


  // -------------------------------------------------------
  // TOTAL DE RETIROS
  // -------------------------------------------------------

  const totalRetiros =
    movimientos
      .filter(
        movimiento =>
          movimiento.tipo ===
          "retiro"
      )
      .reduce(

        (total, movimiento) => {

          return (
            total +
            Number(
              movimiento.monto || 0
            )
          );

        },

        0

      );


  // -------------------------------------------------------
  // TOTAL DE ENTRADAS
  // -------------------------------------------------------

  const totalEntradas =

    fondoInicial +

    totalVentas +

    totalIngresos;


  // -------------------------------------------------------
  // EFECTIVO ESPERADO
  // -------------------------------------------------------

  const efectivoEsperado =

    fondoInicial +

    totalVentas +

    totalIngresos -

    totalRetiros;


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
// ACTUALIZAR EFECTIVO ESPERADO
// =========================================================
//
// Esta función queda disponible por compatibilidad.
// La pantalla de caja NO necesita utilizarla para
// calcular ventas, ingresos o retiros.
//
// El efectivo esperado se calcula automáticamente
// mediante obtenerResumenCaja().
//
// =========================================================

export async function actualizarEfectivoEsperado(
  cajaId,
  incremento
) {

  if (!cajaId) {

    throw new Error(
      "No se proporcionó el ID de la caja."
    );

  }


  const cantidad =
    Number(incremento);


  if (isNaN(cantidad)) {

    throw new Error(
      "El incremento debe ser un número válido."
    );

  }


  const cajaRef =
    doc(
      db,
      TABLA_CAJAS,
      cajaId
    );


  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          TABLA_CAJAS
        ),

        where(
          "abierta",
          "==",
          true
        )
      )
    );


  const cajaDoc =
    snapshot.docs.find(
      d =>
        d.id === cajaId
    );


  if (!cajaDoc) {

    throw new Error(
      "La caja no está abierta."
    );

  }


  const datosCaja =
    cajaDoc.data();


  const actual =
    Number(
      datosCaja.efectivoEsperado || 0
    );


  const nuevo =
    actual + cantidad;


  if (nuevo < 0) {

    throw new Error(
      "El efectivo esperado no puede ser negativo."
    );

  }


  await updateDoc(

    cajaRef,

    {

      efectivoEsperado:
        nuevo

    }

  );


  return nuevo;
}


// =========================================================
// CERRAR CAJA
// =========================================================

export async function cerrarCaja({

  cajaId,

  efectivoReal,

  denominaciones,

  notas

}) {

  if (!cajaId) {

    throw new Error(
      "No se proporcionó el ID de la caja."
    );

  }


  const cantidadReal =
    Number(
      efectivoReal
    );


  if (
    isNaN(cantidadReal) ||
    cantidadReal < 0
  ) {

    throw new Error(
      "El efectivo contado no es válido."
    );

  }


  // -------------------------------------------------------
  // OBTENER RESUMEN ACTUAL
  // -------------------------------------------------------

  const resumen =
    await obtenerResumenCaja();


  const caja =
    resumen.caja;


  if (
    !caja ||
    caja.id !== cajaId
  ) {

    throw new Error(
      "La caja no está abierta o ya fue cerrada."
    );

  }


  // -------------------------------------------------------
  // EFECTIVO ESPERADO
  // -------------------------------------------------------

  const efectivoEsperado =
    Number(
      resumen.efectivoEsperado || 0
    );


  // -------------------------------------------------------
  // DIFERENCIA
  // -------------------------------------------------------

  const diferencia =
    cantidadReal -
    efectivoEsperado;


  // -------------------------------------------------------
  // ACTUALIZAR CAJA
  // -------------------------------------------------------

  const cajaRef =
    doc(
      db,
      TABLA_CAJAS,
      cajaId
    );


  
  await updateDoc(

    cajaRef,

    {

      abierta:
        false,

      efectivoEsperado:
        efectivoEsperado,

      efectivoReal:
        cantidadReal,

      diferencia:
        diferencia,

      denominaciones:
        denominaciones || {},

      notasCierre:
        notas?.trim() || "",

      fechaCierre:
        Timestamp.now()

    }

  );


  return {

    efectivoEsperado,

    efectivoReal:
      cantidadReal,

    diferencia

  };
}