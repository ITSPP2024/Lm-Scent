import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/apertura")({
  head: () => ({ meta: [{ title: "SCENT LM | Apertura de Caja" }] }),
  component: () => <ScreenFrame src="/screens/apertura.html" title="Apertura" />,
});
