import {
    getDocs,
    collection,
    query,
    where,
    orderBy,
    Timestamp
}
from "firebase/firestore";


import { db } from "./firebase";


/* ========================================================= */
/* CONFIGURACIÓN */
/* ========================================================= */

const tablaVentas = "ventas";


let todasLasVentas = [];


let periodoActual = "hoy";


/* ========================================================= */
/* FORMATO MONEDA */
/* ========================================================= */

function fmt(valor) {

    return new Intl.NumberFormat(
        "es-MX",
        {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2
        }
    ).format(
        Number(valor) || 0
    );

}


/* ========================================================= */
/* FECHA INICIAL */
/* ========================================================= */

function fechaDesde(periodo) {

    const fecha =
        new Date();


    /* ===================================================== */
    /* HOY */
    /* ===================================================== */

    if (
        periodo === "hoy"
    ) {

        fecha.setHours(
            0,
            0,
            0,
            0
        );

    }


    /* ===================================================== */
    /* ÚLTIMOS 7 DÍAS */
/* ===================================================== */

    else if (
        periodo === "semana"
    ) {

        fecha.setDate(
            fecha.getDate() - 6
        );

        fecha.setHours(
            0,
            0,
            0,
            0
        );

    }


    /* ===================================================== */
    /* MES ACTUAL */
    /* ===================================================== */

    else if (
        periodo === "mes"
    ) {

        fecha.setDate(
            1
        );

        fecha.setHours(
            0,
            0,
            0,
            0
        );

    }


    return fecha;

}


/* ========================================================= */
/* CONVERTIR FECHA */
/* ========================================================= */

function convertirFecha(fecha) {

    if (
        !fecha
    ) {

        return null;

    }


    /* ===================================================== */
    /* FIREBASE TIMESTAMP */
    /* ===================================================== */

    if (
        typeof fecha.toDate === "function"
    ) {

        return fecha.toDate();

    }


    /* ===================================================== */
    /* DATE */
    /* ===================================================== */

    if (
        fecha instanceof Date
    ) {

        return fecha;

    }


    /* ===================================================== */
    /* TIMESTAMP SERIALIZADO */
/* ===================================================== */

    if (
        typeof fecha === "object" &&
        typeof fecha.seconds === "number"
    ) {

        return new Date(
            fecha.seconds * 1000
        );

    }


    /* ===================================================== */
    /* STRING / NUMBER */
/* ===================================================== */

    const resultado =
        new Date(
            fecha
        );


    if (
        Number.isNaN(
            resultado.getTime()
        )
    ) {

        return null;

    }


    return resultado;

}


/* ========================================================= */
/* ESCAPAR HTML */
/* ========================================================= */

function escaparHTML(valor) {

    return String(
        valor ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ========================================================= */
/* PRODUCTOS DE UNA VENTA */
/* ========================================================= */

function obtenerProductosVenta(venta) {

    if (
        Array.isArray(
            venta.productos
        )
    ) {

        return venta.productos;

    }


    if (
        Array.isArray(
            venta.items
        )
    ) {

        return venta.items;

    }


    return [];

}


/* ========================================================= */
/* CARGAR VENTAS */
/* ========================================================= */

async function cargarVentas() {

    const fechaInicio =
        fechaDesde(
            periodoActual
        );


    console.log(
        "Reportes - db:",
        db
    );


    console.log(
        "Reportes - periodo:",
        periodoActual
    );


    console.log(
        "Reportes - desde:",
        fechaInicio
    );


    /* ===================================================== */
    /* REFERENCIA COLECCIÓN */
/* ===================================================== */

    const ventasRef =
        collection(
            db,
            tablaVentas
        );


    /* ===================================================== */
    /* CONSULTA */
/* ===================================================== */

    const consulta =
        query(

            ventasRef,

            where(
                "fecha",
                ">=",
                Timestamp.fromDate(
                    fechaInicio
                )
            ),

            orderBy(
                "fecha",
                "desc"
            )

        );


    /* ===================================================== */
    /* OBTENER DOCUMENTOS */
/* ===================================================== */

    const snapshot =
        await getDocs(
            consulta
        );


    /* ===================================================== */
    /* CONVERTIR DATOS */
/* ===================================================== */

    todasLasVentas =

        snapshot.docs

            .filter(
                documento =>
                    documento.id !== "base"
            )

            .map(
                documento => ({

                    id:
                        documento.id,

                    ...documento.data()

                })
            );


    /* ===================================================== */
    /* ORDENAR NUEVAMENTE */
/* ===================================================== */

    todasLasVentas.sort(

        (
            a,
            b
        ) => {

            const fechaA =
                convertirFecha(
                    a.fecha
                )?.getTime() || 0;


            const fechaB =
                convertirFecha(
                    b.fecha
                )?.getTime() || 0;


            return fechaB - fechaA;

        }

    );


    return todasLasVentas;

}


/* ========================================================= */
/* CALCULAR UNIDADES */
/* ========================================================= */

function calcularUnidades() {

    return todasLasVentas.reduce(

        (
            acumulado,
            venta
        ) => {

            const productos =
                obtenerProductosVenta(
                    venta
                );


            const unidadesVenta =
                productos.reduce(

                    (
                        suma,
                        producto
                    ) => {

                        const cantidad =
                            Number(
                                producto.cantidad ??
                                producto.qty ??
                                1
                            );


                        return suma +
                            (
                                Number.isFinite(
                                    cantidad
                                )
                                    ? cantidad
                                    : 1
                            );

                    },

                    0

                );


            return acumulado +
                unidadesVenta;

        },

        0

    );

}


/* ========================================================= */
/* RENDERIZAR KPIs */
/* ========================================================= */

function renderKPIs() {

    /* ===================================================== */
    /* INGRESOS */
/* ===================================================== */

    const total =
        todasLasVentas.reduce(

            (
                acumulado,
                venta
            ) => {

                return acumulado +
                    (
                        Number(
                            venta.total
                        ) || 0
                    );

            },

            0

        );


    /* ===================================================== */
    /* VENTAS */
/* ===================================================== */

    const ventas =
        todasLasVentas.length;


    /* ===================================================== */
    /* TICKET */
/* ===================================================== */

    const ticket =
        ventas > 0
            ? total / ventas
            : 0;


    /* ===================================================== */
    /* UNIDADES */
/* ===================================================== */

    const unidades =
        calcularUnidades();


    /* ===================================================== */
    /* ELEMENTOS */
/* ===================================================== */

    const kpiIngresos =
        document.getElementById(
            "kpi-ingresos"
        );


    const kpiTicket =
        document.getElementById(
            "kpi-ticket"
        );


    const kpiVentas =
        document.getElementById(
            "kpi-ventas"
        );


    const kpiUnidades =
        document.getElementById(
            "kpi-unidades"
        );


    /* ===================================================== */
    /* ACTUALIZAR */
/* ===================================================== */

    if (
        kpiIngresos
    ) {

        kpiIngresos.textContent =
            fmt(
                total
            );

    }


    if (
        kpiTicket
    ) {

        kpiTicket.textContent =
            fmt(
                ticket
            );

    }


    if (
        kpiVentas
    ) {

        kpiVentas.textContent =
            String(
                ventas
            );

    }


    if (
        kpiUnidades
    ) {

        kpiUnidades.textContent =
            String(
                unidades
            );

    }

}


/* ========================================================= */
/* RENDERIZAR TABLA */
/* ========================================================= */

function renderTabla() {

    const tabla =
        document.getElementById(
            "tabla-tx"
        );


    if (
        !tabla
    ) {

        console.warn(
            "No se encontró #tabla-tx"
        );

        return;

    }


    /* ===================================================== */
    /* SIN VENTAS */
/* ===================================================== */

    if (
        todasLasVentas.length === 0
    ) {

        tabla.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="px-8 py-8 text-center text-on-surface-variant"
                >

                    No hay ventas en este periodo.

                </td>

            </tr>

        `;

        return;

    }


    /* ===================================================== */
    /* TABLA */
/* ===================================================== */

    tabla.innerHTML =

        todasLasVentas

            .slice(
                0,
                25
            )

            .map(

                (
                    venta,
                    indice
                ) => {

                    /* ===================================== */
                    /* FECHA */
/* ===================================== */

                    const fecha =
                        convertirFecha(
                            venta.fecha
                        );


                    const fechaTexto =

                        fecha

                            ? fecha.toLocaleString(
                                "es-MX",
                                {
                                    dateStyle:
                                        "short",
                                    timeStyle:
                                        "short"
                                }
                            )

                            : "Sin fecha";


                    /* ===================================== */
                    /* PRODUCTOS */
/* ===================================== */

                    const productos =
                        obtenerProductosVenta(
                            venta
                        );


                    const productosTexto =

                        productos.length

                            ? productos

                                .map(

                                    producto => {

                                        const nombre =
                                            escaparHTML(
                                                producto.nombre ||
                                                producto.name ||
                                                "Producto"
                                            );


                                        const cantidad =
                                            Number(
                                                producto.cantidad ??
                                                producto.qty ??
                                                1
                                            ) || 1;


                                        return `${nombre} ×${cantidad}`;

                                    }

                                )

                                .join(
                                    ", "
                                )

                            : "—";


                    /* ===================================== */
                    /* TOTAL */
/* ===================================== */

                    const total =
                        Number(
                            venta.total
                        ) || 0;


                    /* ===================================== */
                    /* ID */
/* ===================================== */

                    const ventaId =
                        String(
                            venta.id ||
                            indice + 1
                        );


                    /* ===================================== */
                    /* FILA */
/* ===================================== */

                    return `

                        <tr
                            class="
                                hover:bg-surface-container-high
                                transition-colors
                            "
                        >

                            <td class="px-8 py-5">

                                #${escaparHTML(
                                    ventaId
                                        .slice(
                                            0,
                                            8
                                        )
                                        .toUpperCase()
                                )}

                            </td>


                            <td class="px-8 py-5">

                                ${productosTexto}

                            </td>


                            <td class="px-8 py-5">

                                ${escaparHTML(
                                    fechaTexto
                                )}

                            </td>


                            <td
                                class="
                                    px-8
                                    py-5
                                    text-primary
                                    font-semibold
                                "
                            >

                                ${fmt(
                                    total
                                )}

                            </td>


                            <td class="px-8 py-5">

                                <span
                                    class="
                                        px-3
                                        py-1
                                        bg-green-900/30
                                        text-green-400
                                        rounded-full
                                        text-[10px]
                                        font-label-caps
                                    "
                                >

                                    Completado

                                </span>

                            </td>

                        </tr>

                    `;

                }

            )

            .join(
                ""
            );

}


/* ========================================================= */
/* ACTUALIZAR */
/* ========================================================= */

async function actualizar() {

    try {

        await cargarVentas();

        renderKPIs();

        renderTabla();

        return todasLasVentas;

    }

    catch (
        error
    ) {

        console.error(
            "ERROR AL CARGAR REPORTES:",
            error
        );


        const tabla =
            document.getElementById(
                "tabla-tx"
            );


        if (
            tabla
        ) {

            tabla.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="
                            px-8
                            py-8
                            text-center
                            text-error
                        "
                    >

                        Error al cargar los reportes.

                    </td>

                </tr>

            `;

        }


        return [];

    }

}


/* ========================================================= */
/* BOTONES DE PERIODO */
/* ========================================================= */

function inicializarBotonesPeriodo() {

    const botones =
        document.querySelectorAll(
            ".periodo-btn"
        );


    botones.forEach(

        boton => {

            boton.addEventListener(

                "click",

                async () => {

                    const periodo =
                        boton.dataset.p;


                    if (
                        !periodo
                    ) {

                        return;

                    }


                    if (
                        periodoActual ===
                        periodo
                    ) {

                        return;

                    }


                    botones.forEach(
                        b => {

                            b.classList.remove(
                                "active"
                            );

                        }
                    );


                    boton.classList.add(
                        "active"
                    );


                    periodoActual =
                        periodo;


                    await actualizar();

                }

            );

        }

    );

}


/* ========================================================= */
/* EXPORTACIONES */
/* ========================================================= */

export {

    actualizar,

    cargarVentas,

    renderKPIs,

    renderTabla,

    convertirFecha,

    fechaDesde,

    calcularUnidades

};


/* ========================================================= */
/* INICIO */
/* ========================================================= */

if (
    typeof document !== "undefined"
) {

    inicializarBotonesPeriodo();

    actualizar();

}