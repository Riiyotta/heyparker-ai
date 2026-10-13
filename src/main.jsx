import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { routes } from "./routes.js";

const norm = (p) => p.replace(/\/+$/, "") || "/";
const route = routes.find((r) => r.path === norm(decodeURIComponent(location.pathname))) || null;
const setAttrs = (el, attrs) => { for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); };
if (route) { setAttrs(document.documentElement, route.html); setAttrs(document.body, route.body); document.title = route.title; }
(route ? route.load() : Promise.resolve(null)).then((m) => createRoot(document.getElementById("root")).render(<App Page={m?.default} />));
