import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/caja")({
  head: () => ({ meta: [{ title: "SCENT LM | Gestión de Caja" }] }),
  component: () => <ScreenFrame src="/screens/caja.html" title="Caja" />,
});
