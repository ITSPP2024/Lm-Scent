import { Link, useLocation, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Redirigir a bienvenida si se intenta acceder a pantallas protegidas sin sesión iniciada
  useEffect(() => {
    if (pathname !== "/" && pathname !== "/apertura") {
      try {
        const sesion =
          sessionStorage.getItem("lm_sesion_activa") || localStorage.getItem("lm_sesion_activa");
        if (!sesion) {
          console.info("[Auth Guard] Sin sesión activa, redirigiendo a Bienvenida...");
          navigate({ to: "/" });
        }
      } catch {
        /* ignore */
      }
    }
  }, [pathname, navigate]);

  // After iframe loads, rewrite the top-nav anchor links inside the HTML
  // so clicks navigate the parent SPA between routes.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc) return;

        // In Electron, ensure iframe gets keyboard and window focus
        iframe.focus();
        win?.focus();

        // Restore focus on click or interaction anywhere inside iframe
        doc.addEventListener("mousedown", () => {
          iframe.focus();
          win?.focus();
        });

        doc.addEventListener("focusin", () => {
          iframe.focus();
        });

        // Global safeguard for Electron: override native alert to prevent blocking OS dialogs
        if (win) {
          win.alert = function (message) {
            console.info("[In-App Notice]", message);
            try {
              let toast = doc.getElementById("__global_electron_toast");
              if (!toast) {
                toast = doc.createElement("div");
                toast.id = "__global_electron_toast";
                toast.style.cssText =
                  "position:fixed;bottom:24px;right:24px;z-index:99999;background:#2b2930;color:#f5f2f7;padding:12px 20px;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.6);font-size:13px;font-weight:600;font-family:system-ui,-apple-system,sans-serif;border:1px solid #49454f;transition:all .3s ease;transform:translateY(0);opacity:1;pointer-events:none;";
                doc.body.appendChild(toast);
              }
              toast.textContent = String(message ?? "");
              toast.style.opacity = "1";
              toast.style.transform = "translateY(0)";
              setTimeout(() => {
                if (toast) {
                  toast.style.opacity = "0";
                  toast.style.transform = "translateY(12px)";
                }
              }, 3200);
            } catch {
              /* ignore */
            }
          };
        }

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
      <iframe ref={iframeRef} src={src} title={title} className="flex-1 w-full border-0" />
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
