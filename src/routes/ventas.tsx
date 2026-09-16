import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/ventas")({
  head: () => ({ meta: [{ title: "SCENT LM | Punto de Venta" }] }),
  component: () => <ScreenFrame src="/screens/ventas.html" title="Ventas" />,
});
