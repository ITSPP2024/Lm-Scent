import { getDocs, collection } from "firebase/firestore";

import { db } from "./firebase";
import { verificarSesionOVolverAWelcome, cerrarSesion } from "./movimientosCaja.js";

// Validar que exista una sesión activa; de lo contrario redirigir a Bienvenida
const sesionUsuario = verificarSesionOVolverAWelcome();
if (sesionUsuario) {
  const badge = document.getElementById("usuario-sesion-badge");
  const nombreEl = document.getElementById("nombre-usuario-sesion");
  if (badge && nombreEl) {
    nombreEl.textContent = sesionUsuario.nombre || "Usuario";
    badge.classList.remove("hidden");
  }
}

const btnLogout = document.getElementById("btn-cerrar-sesion");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    cerrarSesion();
    if (window.top && window.top !== window.self) {
      window.top.location.href = "/";
    } else {
      window.location.assign("/screens/welcome.html");
    }
  });
}

/* ========================================================= */
/* CONFIGURACIÓN Y ESTADO */
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
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

/* ========================================================= */
/* FECHA INICIAL */
/* ========================================================= */

function fechaDesde(periodo) {
  const fecha = new Date();

  if (periodo === "hoy") {
    fecha.setHours(0, 0, 0, 0);
  } else if (periodo === "semana") {
    fecha.setDate(fecha.getDate() - 6);
    fecha.setHours(0, 0, 0, 0);
  } else if (periodo === "mes") {
    fecha.setDate(1);
    fecha.setHours(0, 0, 0, 0);
  }

  return fecha;
}

function convertirFechaInput(valor, finDelDia = false) {
  if (!valor) return null;

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
    finDelDia ? 999 : 0,
  );

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatoFechaInput(fecha) {
  if (!fecha) return "";

  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

function obtenerRangoActual() {
  if (filtroFechaDesde && filtroFechaHasta) {
    return {
      inicio: filtroFechaDesde,
      fin: filtroFechaHasta,
    };
  }

  const fin = new Date();
  fin.setHours(23, 59, 59, 999);

  return {
    inicio: fechaDesde(periodoActual),
    fin: fin,
  };
}

function actualizarEtiquetaPeriodo() {
  const etiqueta = document.getElementById("periodo-label");
  if (!etiqueta) return;

  if (filtroFechaDesde && filtroFechaHasta) {
    etiqueta.textContent = `Del ${filtroFechaDesde.toLocaleDateString("es-MX")} al ${filtroFechaHasta.toLocaleDateString("es-MX")}`;
    return;
  }

  const hoy = new Date();

  if (periodoActual === "hoy") {
    etiqueta.textContent = `Hoy, ${hoy.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  } else if (periodoActual === "semana") {
    etiqueta.textContent = "Últimos 7 días";
  } else {
    etiqueta.textContent = `Mes de ${hoy.toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
    })}`;
  }
}

/* ========================================================= */
/* CONVERTIR FECHA ROBUSTO */
/* ========================================================= */

function convertirFecha(fecha) {
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
  // Para pedidos de la app móvil entregados, preferir la fecha de entrega o actualización si existe
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

/* ========================================================= */
/* ESCAPAR HTML */
/* ========================================================= */

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========================================================= */
/* PRODUCTOS DE UNA VENTA */
/* ========================================================= */

function obtenerProductosVenta(venta) {
  if (Array.isArray(venta.productos)) {
    return venta.productos;
  }
  if (Array.isArray(venta.items)) {
    return venta.items;
  }
  return [];
}

/* ========================================================= */
/* CARGAR VENTAS (POS + APP MÓVIL ENTREGADOS) */
/* ========================================================= */

async function cargarVentas() {
  const rango = obtenerRangoActual();
  const fechaInicio = rango.inicio;
  const fechaFin = rango.fin;

  try {
    const snapshot = await getDocs(collection(db, tablaVentas));
    const docs = snapshot.docs
      .filter((d) => d.id !== "base")
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }));

    // Filtrar y procesar ventas
    todasLasVentas = docs.filter((v) => {
      const esApp =
        v.origen === "app" ||
        v.origen === "app_movil" ||
        v.canal === "app_movil" ||
        v.canal === "app" ||
        v.esVentaApp === true ||
        Boolean(v.metodoEntrega) ||
        Boolean(v.clienteMovil);

      // Si es pedido de la App Móvil, solo se contabiliza en reportes si está ENTREGADO/COMPLETADO
      if (esApp) {
        const estado = String(v.estado || v.estadoEntrega || v.estadoPedido || "").toLowerCase();
        const esEntregado =
          estado === "entregado" ||
          estado === "completado" ||
          estado === "despachado" ||
          v.entregado === true ||
          v.completado === true;

        if (!esEntregado) {
          return false; // Pedidos aún pendientes o cancelados no cuentan como venta realizada
        }
      }

      // Validar fecha dentro del rango del período
      const fecha = obtenerFechaVenta(v);
      if (!fecha) return false;

      return fecha >= fechaInicio && fecha <= fechaFin;
    });

    // Ordenar por fecha descendente
    todasLasVentas.sort((a, b) => {
      const fechaA = obtenerFechaVenta(a)?.getTime() || 0;
      const fechaB = obtenerFechaVenta(b)?.getTime() || 0;
      return fechaB - fechaA;
    });

    return todasLasVentas;
  } catch (error) {
    console.error("Error al cargar ventas en Reportes:", error);
    todasLasVentas = [];
    return [];
  }
}

/* ========================================================= */
/* CALCULAR UNIDADES */
/* ========================================================= */

function calcularUnidades() {
  return todasLasVentas.reduce((acumulado, venta) => {
    const productos = obtenerProductosVenta(venta);
    const unidadesVenta = productos.reduce((suma, producto) => {
      const cantidad = Number(producto.cantidad ?? producto.qty ?? 1);
      return suma + (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1);
    }, 0);

    return acumulado + (unidadesVenta > 0 ? unidadesVenta : Number(venta.numArticulos) || 1);
  }, 0);
}

/* ========================================================= */
/* RENDERIZAR KPIs */
/* ========================================================= */

function renderKPIs() {
  const total = todasLasVentas.reduce((acumulado, venta) => {
    return acumulado + (Number(venta.total) || 0);
  }, 0);

  const ventas = todasLasVentas.length;
  const ticket = ventas > 0 ? total / ventas : 0;
  const unidades = calcularUnidades();

  const kpiIngresos = document.getElementById("kpi-ingresos");
  const kpiTicket = document.getElementById("kpi-ticket");
  const kpiVentas = document.getElementById("kpi-ventas");
  const kpiUnidades = document.getElementById("kpi-unidades");

  if (kpiIngresos) kpiIngresos.textContent = fmt(total);
  if (kpiTicket) kpiTicket.textContent = fmt(ticket);
  if (kpiVentas) kpiVentas.textContent = String(ventas);
  if (kpiUnidades) kpiUnidades.textContent = String(unidades);

  const totalTxLabel = document.getElementById("total-tx");
  if (totalTxLabel) {
    totalTxLabel.textContent = `${ventas} transacción${ventas === 1 ? "" : "es"}`;
  }
}

/* ========================================================= */
/* RENDERIZAR TABLA DE TRANSACCIONES */
/* ========================================================= */

function renderTabla() {
  const tabla = document.getElementById("tabla-tx");
  if (!tabla) return;

  if (todasLasVentas.length === 0) {
    tabla.innerHTML = `
            <tr>
                <td colspan="5" class="px-8 py-8 text-center text-on-surface-variant">
                    No hay ventas o pedidos entregados en este periodo.
                </td>
            </tr>
        `;
    return;
  }

  tabla.innerHTML = todasLasVentas
    .slice(0, 35)
    .map((venta, indice) => {
      const fecha = obtenerFechaVenta(venta);
      const fechaTexto = fecha
        ? fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
        : "Sin fecha";

      const productos = obtenerProductosVenta(venta);
      const productosTexto = productos.length
        ? productos
            .map((p) => {
              const nombre = escaparHTML(p.nombre || p.name || "Producto");
              const cantidad = Number(p.cantidad ?? p.qty ?? 1) || 1;
              return `${nombre} ×${cantidad}`;
            })
            .join(", ")
        : venta.cliente
          ? `Pedido de ${escaparHTML(venta.cliente)}`
          : "—";

      const total = Number(venta.total) || 0;
      const ventaId = String(venta.id || indice + 1);

      const esApp =
        venta.origen === "app" ||
        venta.origen === "app_movil" ||
        venta.canal === "app_movil" ||
        venta.canal === "app" ||
        venta.esVentaApp === true;

      const esEfectivo =
        venta.esEfectivo === true ||
        String(venta.metodoPago || "")
          .toLowerCase()
          .includes("efectivo") ||
        String(venta.tipoPago || "")
          .toLowerCase()
          .includes("efectivo");

      const metodoTexto = esEfectivo ? "Efectivo" : venta.metodoPago || "Tarjeta";

      const badgeHtml = esApp
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-label-caps font-bold">
                <span class="material-symbols-outlined text-[12px]">smartphone</span>
                App Móvil (${metodoTexto})
               </span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-label-caps font-bold">
                <span class="material-symbols-outlined text-[12px]">point_of_sale</span>
                Mostrador POS (${metodoTexto})
               </span>`;

      return `
            <tr class="hover:bg-surface-container-high transition-colors">
                <td class="px-8 py-5 font-medium text-on-surface">
                    #${escaparHTML(ventaId.slice(0, 8).toUpperCase())}
                </td>
                <td class="px-8 py-5 max-w-xs truncate text-on-surface-variant" title="${escaparHTML(productosTexto)}">
                    ${productosTexto}
                </td>
                <td class="px-8 py-5 text-on-surface-variant font-label-caps text-xs">
                    ${escaparHTML(fechaTexto)}
                </td>
                <td class="px-8 py-5 text-primary font-bold font-price-display text-base">
                    ${fmt(total)}
                </td>
                <td class="px-8 py-5">
                    ${badgeHtml}
                </td>
            </tr>
        `;
    })
    .join("");
}

/* ========================================================= */
/* RENDERIZAR GRÁFICA DE VENTAS */
/* ========================================================= */

function renderChart() {
  const barras = document.getElementById("chart-bars");
  const etiquetas = document.getElementById("chart-labels");

  if (!barras || !etiquetas) return;

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

  todasLasVentas.forEach((venta) => {
    const fecha = obtenerFechaVenta(venta);
    if (!fecha) return;

    let clave;
    let etiqueta;

    if (periodoActual === "hoy") {
      clave = [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0"),
        String(fecha.getHours()).padStart(2, "0"),
      ].join("-");
      etiqueta = fecha.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      clave = [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0"),
      ].join("-");
      etiqueta = fecha.toLocaleDateString("es-MX", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }

    const grupo = grupos.get(clave) || { etiqueta, valor: 0 };
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

  const maximo = Math.max(...entradas.map((g) => g.valor), 1);

  barras.innerHTML = `
        <div class="w-full h-full flex items-end gap-3">
            ${entradas
              .map((grupo) => {
                const altura = Math.max(10, (grupo.valor / maximo) * 100);

                return `
                    <div class="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-0">
                        <span class="text-[9px] text-primary font-bold whitespace-nowrap">
                            ${escaparHTML(fmt(grupo.valor))}
                        </span>
                        <div class="w-full flex-1 flex items-end">
                            <div
                                class="w-full bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-all duration-300 shadow-sm shadow-primary/20"
                                style="height: ${altura}%"
                                title="${escaparHTML(fmt(grupo.valor))}"
                            ></div>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;

  etiquetas.innerHTML = entradas
    .map(
      (grupo) => `
        <span class="flex-1 text-center truncate text-[10px] text-on-surface-variant font-label-caps">
            ${escaparHTML(grupo.etiqueta)}
        </span>
    `,
    )
    .join("");
}

/* ========================================================= */
/* RENDERIZAR PRODUCTOS TOP */
/* ========================================================= */

function renderTopProductos() {
  const contenedor = document.getElementById("top-productos");
  if (!contenedor) return;

  const conteo = {};

  todasLasVentas.forEach((venta) => {
    obtenerProductosVenta(venta).forEach((producto) => {
      const nombre = producto.nombre || producto.producto || producto.name || "Producto sin nombre";
      const cantidad = Number(producto.cantidad ?? producto.qty ?? 1) || 1;

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

  contenedor.innerHTML = top
    .map(([nombre, cantidad], indice) => {
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
    })
    .join("");
}

/* ========================================================= */
/* ACTUALIZAR TODO EL REPORTE */
/* ========================================================= */

async function actualizar() {
  const kpiIngresos = document.getElementById("kpi-ingresos");
  if (kpiIngresos) kpiIngresos.textContent = "...";

  try {
    await cargarVentas();
    actualizarEtiquetaPeriodo();
    renderKPIs();
    renderChart();
    renderTopProductos();
    renderTabla();
    return todasLasVentas;
  } catch (error) {
    console.error("ERROR AL CARGAR REPORTES:", error);
    const tabla = document.getElementById("tabla-tx");
    if (tabla) {
      tabla.innerHTML = `
                <tr>
                    <td colspan="5" class="px-8 py-8 text-center text-error">
                        Error al cargar los reportes de ventas.
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
  const rango = obtenerRangoActual();
  const total = todasLasVentas.reduce(
    (acumulado, venta) => acumulado + (Number(venta.total) || 0),
    0,
  );
  const unidades = calcularUnidades();

  const filas = todasLasVentas.length
    ? todasLasVentas
        .map((venta, indice) => {
          const fecha = obtenerFechaVenta(venta);
          const productos = obtenerProductosVenta(venta)
            .map(
              (p) =>
                `${p.nombre || p.producto || p.name || "Producto"} x${Number(p.cantidad ?? p.qty ?? 1) || 1}`,
            )
            .join(", ");

          const esApp =
            venta.origen === "app" ||
            venta.origen === "app_movil" ||
            venta.canal === "app_movil" ||
            venta.canal === "app" ||
            venta.esVentaApp === true;

          const canalTexto = esApp ? "App Móvil (Entregado)" : "Mostrador POS";
          const metodoTexto =
            venta.esEfectivo ||
            String(venta.metodoPago || "")
              .toLowerCase()
              .includes("efectivo")
              ? "Efectivo"
              : venta.metodoPago || "Tarjeta";

          return `
                <tr>
                    <td>${escaparHTML(venta.id || indice + 1)}</td>
                    <td>${escaparHTML(canalTexto)}</td>
                    <td>${escaparHTML(metodoTexto)}</td>
                    <td>${escaparHTML(productos || "Sin productos")}</td>
                    <td>${escaparHTML(fecha ? fecha.toLocaleString("es-MX") : "Sin fecha")}</td>
                    <td class="numero">${(Number(venta.total) || 0).toFixed(2)}</td>
                    <td>Completado</td>
                </tr>
            `;
        })
        .join("")
    : `<tr><td colspan="7">No hay ventas en este periodo.</td></tr>`;

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
                table { border-collapse: collapse; margin-bottom: 24px; min-width: 800px; }
                th, td { border: 1px solid #b9b9b9; padding: 7px 9px; }
                th { background: #f2ca50; font-weight: bold; }
                .numero { mso-number-format: "0.00"; text-align: right; }
            </style>
        </head>
        <body>
            <h1>Reporte Integral de Ventas (Tienda y App Móvil)</h1>
            <table>
                <tr><th>Periodo</th><td>${escaparHTML(rangoTexto)}</td></tr>
                <tr><th>Generado</th><td>${escaparHTML(new Date().toLocaleString("es-MX"))}</td></tr>
                <tr><th>Ventas y Pedidos Entregados</th><td>${todasLasVentas.length}</td></tr>
                <tr><th>Unidades Vendidas</th><td>${unidades}</td></tr>
                <tr><th>Ingresos Totales</th><td class="numero">${total.toFixed(2)}</td></tr>
                <tr><th>Ticket Promedio</th><td class="numero">${(todasLasVentas.length ? total / todasLasVentas.length : 0).toFixed(2)}</td></tr>
            </table>

            <h2>Detalle Consolidado de Ventas</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID / Folio</th>
                        <th>Canal</th>
                        <th>Método Pago</th>
                        <th>Productos</th>
                        <th>Fecha y Hora</th>
                        <th>Monto Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </body>
        </html>`;

  const inicioArchivo = formatoFechaInput(rango.inicio);
  const finArchivo = formatoFechaInput(rango.fin);

  const blob = new Blob(["\ufeff", contenido], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `reporte-ventas-${inicioArchivo}-${finArchivo}.xls`;
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ========================================================= */
/* INICIALIZAR CONTROLES */
/* ========================================================= */

function inicializarFiltroFechas() {
  const inputDesde = document.getElementById("filtro-desde");
  const inputHasta = document.getElementById("filtro-hasta");
  const botonAplicar = document.getElementById("aplicar-filtro-fechas");
  const botonExportar = document.getElementById("exportar-excel");
  const error = document.getElementById("error-filtro-fechas");

  if (botonAplicar) {
    botonAplicar.addEventListener("click", async () => {
      const inicio = convertirFechaInput(inputDesde?.value);
      const fin = convertirFechaInput(inputHasta?.value, true);

      if (!inicio || !fin) {
        if (error) {
          error.textContent = "Selecciona una fecha inicial y una fecha final.";
          error.classList.remove("hidden");
        }
        return;
      }

      if (inicio > fin) {
        if (error) {
          error.textContent = "La fecha inicial no puede ser posterior a la fecha final.";
          error.classList.remove("hidden");
        }
        return;
      }

      filtroFechaDesde = inicio;
      filtroFechaHasta = fin;
      periodoActual = "personalizado";

      document.querySelectorAll(".periodo-btn").forEach((b) => b.classList.remove("active"));
      if (error) error.classList.add("hidden");

      await actualizar();
    });
  }

  if (botonExportar) {
    botonExportar.addEventListener("click", exportarExcel);
  }
}

function inicializarBotonesPeriodo() {
  const botones = document.querySelectorAll(".periodo-btn");

  botones.forEach((boton) => {
    boton.addEventListener("click", async () => {
      const periodo = boton.dataset.p;
      if (!periodo || periodoActual === periodo) return;

      botones.forEach((b) => b.classList.remove("active"));
      boton.classList.add("active");

      filtroFechaDesde = null;
      filtroFechaHasta = null;

      const inputDesde = document.getElementById("filtro-desde");
      const inputHasta = document.getElementById("filtro-hasta");
      if (inputDesde) inputDesde.value = "";
      if (inputHasta) inputHasta.value = "";

      periodoActual = periodo;
      await actualizar();
    });
  });
}

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
  calcularUnidades,
};

if (typeof document !== "undefined") {
  inicializarFiltroFechas();
  inicializarBotonesPeriodo();
  actualizar();
}
