import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const NAV = [
  { to: "/ventas", label: "Ventas" },
  { to: "/inventario", label: "Inventario" },
  { to: "/reportes", label: "Reportes" },
  { to: "/caja", label: "Caja" },
  { to: "/configuracion", label: "Configuración" },
] as const;

export default function ScreenFrame({ src, title }: { src: string; title: string }) {
  const { pathname } = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // After iframe loads, rewrite the top-nav anchor links inside the HTML
  // so clicks navigate the parent SPA between routes.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const map: Record<string, string> = {
          ventas: "/ventas",
          inventario: "/inventario",
          reportes: "/reportes",
          caja: "/caja",
          configuración: "/configuracion",
          configuracion: "/configuracion",
        };
        doc.querySelectorAll("a").forEach((a) => {
          const rawHref = a.getAttribute("href") || "";
          const key = (a.textContent || "").trim().toLowerCase();
          let target = map[key];
          // Any internal absolute-path link should navigate the parent SPA
          if (!target && rawHref.startsWith("/")) target = rawHref;
          if (target) {
            a.setAttribute("href", target);
            a.addEventListener("click", (e) => {
              e.preventDefault();
              window.parent.history.pushState({}, "", target);
              window.parent.dispatchEvent(new PopStateEvent("popstate"));
            });
          }
        });
      } catch {
        /* ignore */
      }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [src, pathname]);

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="flex-1 w-full border-0"
      />
      {/* Hidden accessible nav for SPA route discovery */}
      <nav className="sr-only" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to}>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
