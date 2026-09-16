import { createFileRoute } from "@tanstack/react-router";
import ScreenFrame from "@/components/ScreenFrame";

export const Route = createFileRoute("/reportes")({
  head: () => ({ meta: [{ title: "Reportes y Analítica | SCENT LM" }] }),
  component: () => <ScreenFrame src="/screens/reportes.html" title="Reportes" />,
});
