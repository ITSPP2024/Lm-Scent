import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "SCENT LM | Configuración" }] }),
  component: () => <ScreenFrame src="/screens/configuracion.html" title="Configuración" />,
});
