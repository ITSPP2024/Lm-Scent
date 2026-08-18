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
let filtroFechaDesde = null;
let filtroFechaHasta = null;


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


function convertirFechaInput(valor, finDelDia = false) {
    if (!valor) {
        return null;
    }

    const partes = valor.split("-").map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) {
        return null;
    }

    const fecha = new Date(
        partes[0],
        partes[1] - 1,
        partes[2],
        finDelDia ? 23 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 999 : 0
    );

    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatoFechaInput(fecha) {
    if (!fecha) {
        return "";
    }

    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0")
    ].join("-");
}

function obtenerRangoActual() {
    if (
        filtroFechaDesde &&
        filtroFechaHasta
    ) {
        return {
            inicio: filtroFechaDesde,
            fin: filtroFechaHasta
        };
    }

    return {
        inicio: fechaDesde(periodoActual),
        fin: new Date()
    };
}

function actualizarEtiquetaPeriodo() {
    const etiqueta =
        document.getElementById(
            "periodo-label"
        );

    if (!etiqueta) {
        return;
    }

    if (
        filtroFechaDesde &&
        filtroFechaHasta
    ) {
        etiqueta.textContent =
            `Del ${filtroFechaDesde.toLocaleDateString("es-MX")} al ` +
            `${filtroFechaHasta.toLocaleDateString("es-MX")}`;
        return;
    }

    const hoy = new Date();

    if (periodoActual === "hoy") {
        etiqueta.textContent =
            `Hoy, ${hoy.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric"
            })}`;
    } else if (periodoActual === "semana") {
        etiqueta.textContent = "Últimos 7 días";
    } else {
        etiqueta.textContent =
            `Mes de ${hoy.toLocaleDateString("es-MX", {
                month: "long",
                year: "numeric"
            })}`;
    }
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

    const rango =
        obtenerRangoActual();

    const fechaInicio =
        rango.inicio;

    const fechaFin =
        rango.fin;


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

    // La fecha final se filtra en memoria para evitar
    // depender de un índice compuesto de Firestore.
    todasLasVentas =
        todasLasVentas.filter(
            venta => {
                const fecha =
                    convertirFecha(
                        venta.fecha
                    );

                return (
                    fecha &&
                    fecha <= fechaFin
                );
            }
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
/* RENDERIZAR GRÁFICAS */
/* ========================================================= */

function renderChart() {
    const barras = document.getElementById("chart-bars");
    const etiquetas = document.getElementById("chart-labels");

    if (!barras || !etiquetas) {
        return;
    }

    if (!todasLasVentas.length) {
        barras.innerHTML = `
            <div class="text-on-surface-variant text-sm w-full text-center pt-8">
                Sin datos en este período
            </div>
        `;
        etiquetas.innerHTML = "";
        return;
    }

    const grupos = new Map();

    todasLasVentas.forEach(venta => {
        const fecha = convertirFecha(venta.fecha);
        if (!fecha) {
            return;
        }

        let clave;
        let etiqueta;

        if (periodoActual === "hoy") {
            clave = [
                fecha.getFullYear(),
                String(fecha.getMonth() + 1).padStart(2, "0"),
                String(fecha.getDate()).padStart(2, "0"),
                String(fecha.getHours()).padStart(2, "0")
            ].join("-");
            etiqueta = fecha.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit"
            });
        } else {
            clave = [
                fecha.getFullYear(),
                String(fecha.getMonth() + 1).padStart(2, "0"),
                String(fecha.getDate()).padStart(2, "0")
            ].join("-");
            etiqueta = fecha.toLocaleDateString("es-MX", {
                weekday: "short",
                day: "numeric",
                month: "short"
            });
        }

        const grupo = grupos.get(clave) || {
            etiqueta,
            valor: 0
        };
        grupo.valor += Number(venta.total) || 0;
        grupos.set(clave, grupo);
    });

    const entradas = Array.from(grupos.entries())
        .sort(([claveA], [claveB]) => claveA.localeCompare(claveB))
        .slice(-7)
        .map(([, grupo]) => grupo);

    if (!entradas.length) {
        barras.innerHTML = `
            <div class="text-on-surface-variant text-sm w-full text-center">
                Sin datos para mostrar
            </div>
        `;
        etiquetas.innerHTML = "";
        return;
    }

    const maximo = Math.max(
        ...entradas.map(grupo => grupo.valor),
        1
    );

    barras.innerHTML = `
        <div class="w-full h-full flex items-end gap-3">
            ${entradas.map(grupo => {
                const altura = Math.max(
                    8,
                    (grupo.valor / maximo) * 100
                );

                return `
                    <div class="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-0">
                        <span class="text-[9px] text-primary font-bold whitespace-nowrap">
                            ${escaparHTML(fmt(grupo.valor))}
                        </span>
                        <div class="w-full flex-1 flex items-end">
                            <div
                                class="w-full bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-all duration-300"
                                style="height: ${altura}%"
                                title="${escaparHTML(fmt(grupo.valor))}"
                            ></div>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    etiquetas.innerHTML = entradas.map(grupo => `
        <span class="flex-1 text-center truncate">
            ${escaparHTML(grupo.etiqueta)}
        </span>
    `).join("");
}

function renderTopProductos() {
    const contenedor = document.getElementById("top-productos");
    if (!contenedor) {
        return;
    }

    const conteo = {};

    todasLasVentas.forEach(venta => {
        obtenerProductosVenta(venta).forEach(producto => {
            const nombre =
                producto.nombre ||
                producto.producto ||
                producto.name ||
                "Producto sin nombre";
            const cantidad =
                Number(producto.cantidad ?? producto.qty ?? 1) || 1;

            conteo[nombre] = (conteo[nombre] || 0) + cantidad;
        });
    });

    const top = Object.entries(conteo)
        .sort(([, cantidadA], [, cantidadB]) => cantidadB - cantidadA)
        .slice(0, 5);

    if (!top.length) {
        contenedor.innerHTML = `
            <div class="text-on-surface-variant text-sm text-center pt-6">
                Sin ventas en este período
            </div>
        `;
        return;
    }

    const maximo = Math.max(Number(top[0][1]), 1);

    contenedor.innerHTML = top.map(([nombre, cantidad], indice) => {
        const porcentaje = (Number(cantidad) / maximo) * 100;

        return `
            <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] text-primary font-bold shrink-0">
                    ${indice + 1}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center gap-2">
                        <p class="font-label-caps text-label-caps text-on-surface truncate">
                            ${escaparHTML(nombre)}
                        </p>
                        <span class="font-label-caps text-label-caps text-primary shrink-0">
                            ${cantidad} uds
                        </span>
                    </div>
                    <div class="w-full bg-surface-container-lowest h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                            class="bg-primary h-full rounded-full transition-all duration-500"
                            style="width: ${porcentaje}%"
                        ></div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}


/* ========================================================= */
/* ACTUALIZAR */
/* ========================================================= */

async function actualizar() {

    try {

        await cargarVentas();

        actualizarEtiquetaPeriodo();

        renderKPIs();

        renderChart();

        renderTopProductos();

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
/* EXPORTAR REPORTE A EXCEL */
/* ========================================================= */

function exportarExcel() {
    const rango =
        obtenerRangoActual();

    const total =
        todasLasVentas.reduce(
            (acumulado, venta) =>
                acumulado +
                (Number(venta.total) || 0),
            0
        );

    const unidades =
        calcularUnidades();

    const filas =
        todasLasVentas.length
            ? todasLasVentas.map(
                (venta, indice) => {
                    const fecha =
                        convertirFecha(
                            venta.fecha
                        );

                    const productos =
                        obtenerProductosVenta(
                            venta
                        )
                            .map(
                                producto =>
                                    `${producto.nombre || producto.producto || producto.name || "Producto"} x${Number(producto.cantidad ?? producto.qty ?? 1) || 1}`
                            )
                            .join(
                                ", "
                            );

                    return `
                        <tr>
                            <td>${escaparHTML(venta.id || indice + 1)}</td>
                            <td>${escaparHTML(productos || "Sin productos")}</td>
                            <td>${escaparHTML(
                                fecha
                                    ? fecha.toLocaleString("es-MX", {
                                        dateStyle: "short",
                                        timeStyle: "short"
                                    })
                                    : "Sin fecha"
                            )}</td>
                            <td class="numero">${(Number(venta.total) || 0).toFixed(2)}</td>
                            <td>Completado</td>
                        </tr>
                    `;
                }
            ).join("")
            : `
                <tr>
                    <td colspan="5">No hay ventas en este periodo.</td>
                </tr>
            `;

    const rangoTexto =
        filtroFechaDesde && filtroFechaHasta
            ? `Del ${filtroFechaDesde.toLocaleDateString("es-MX")} al ${filtroFechaHasta.toLocaleDateString("es-MX")}`
            : document.getElementById("periodo-label")?.textContent || periodoActual;

    const contenido = `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; color: #222; }
                h1, h2 { color: #8a6500; }
                table { border-collapse: collapse; margin-bottom: 24px; min-width: 760px; }
                th, td { border: 1px solid #b9b9b9; padding: 7px 9px; }
                th { background: #f2ca50; font-weight: bold; }
                .numero { mso-number-format: "0.00"; text-align: right; }
            </style>
        </head>
        <body>
            <h1>Reporte de Ventas</h1>
            <table>
                <tr><th>Periodo</th><td>${escaparHTML(rangoTexto)}</td></tr>
                <tr><th>Generado</th><td>${escaparHTML(new Date().toLocaleString("es-MX"))}</td></tr>
                <tr><th>Ventas realizadas</th><td>${todasLasVentas.length}</td></tr>
                <tr><th>Unidades vendidas</th><td>${unidades}</td></tr>
                <tr><th>Ingresos totales</th><td class="numero">${total.toFixed(2)}</td></tr>
                <tr><th>Ticket promedio</th><td class="numero">${(todasLasVentas.length ? total / todasLasVentas.length : 0).toFixed(2)}</td></tr>
            </table>

            <h2>Detalle de ventas</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Productos</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </body>
        </html>`;

    const inicioArchivo =
        formatoFechaInput(
            rango.inicio
        );

    const finArchivo =
        formatoFechaInput(
            rango.fin
        );

    const blob =
        new Blob(
            ["\ufeff", contenido],
            {
                type: "application/vnd.ms-excel;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const enlace =
        document.createElement(
            "a"
        );

    enlace.href = url;
    enlace.download = `reporte-ventas-${inicioArchivo}-${finArchivo}.xls`;
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}


/* ========================================================= */
/* FILTRO PERSONALIZADO */
/* ========================================================= */

function inicializarFiltroFechas() {
    const inputDesde =
        document.getElementById(
            "filtro-desde"
        );

    const inputHasta =
        document.getElementById(
            "filtro-hasta"
        );

    const botonAplicar =
        document.getElementById(
            "aplicar-filtro-fechas"
        );

    const botonExportar =
        document.getElementById(
            "exportar-excel"
        );

    const error =
        document.getElementById(
            "error-filtro-fechas"
        );

    if (
        botonAplicar
    ) {
        botonAplicar.addEventListener(
            "click",
            async () => {
                const inicio =
                    convertirFechaInput(
                        inputDesde?.value
                    );

                const fin =
                    convertirFechaInput(
                        inputHasta?.value,
                        true
                    );

                if (
                    !inicio ||
                    !fin
                ) {
                    error.textContent =
                        "Selecciona una fecha inicial y una fecha final.";
                    error.classList.remove(
                        "hidden"
                    );
                    return;
                }

                if (
                    inicio > fin
                ) {
                    error.textContent =
                        "La fecha inicial no puede ser posterior a la fecha final.";
                    error.classList.remove(
                        "hidden"
                    );
                    return;
                }

                filtroFechaDesde =
                    inicio;

                filtroFechaHasta =
                    fin;

                periodoActual =
                    "personalizado";

                document.querySelectorAll(
                    ".periodo-btn"
                ).forEach(
                    boton => boton.classList.remove(
                        "active"
                    )
                );

                error.classList.add(
                    "hidden"
                );

                await actualizar();
            }
        );
    }

    if (
        botonExportar
    ) {
        botonExportar.addEventListener(
            "click",
            exportarExcel
        );
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


                    filtroFechaDesde = null;
                    filtroFechaHasta = null;

                    const inputDesde = document.getElementById("filtro-desde");
                    const inputHasta = document.getElementById("filtro-hasta");

                    if (inputDesde) inputDesde.value = "";
                    if (inputHasta) inputHasta.value = "";

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

    renderChart,

    renderTopProductos,

    renderTabla,

    exportarExcel,

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

    inicializarFiltroFechas();

    inicializarBotonesPeriodo();

    actualizar();

}