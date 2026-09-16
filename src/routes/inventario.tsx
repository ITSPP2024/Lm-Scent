import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/inventario")({
  head: () => ({ meta: [{ title: "SCENT LM | Gestión de Inventario" }] }),
  component: () => <ScreenFrame src="/screens/inventario.html" title="Inventario" />,
});
