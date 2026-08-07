import { app as o, BrowserWindow as l, ipcMain as f } from "electron";
import { fileURLToPath as m } from "node:url";
import c from "node:fs";
import e from "node:path";
const d = e.dirname(m(import.meta.url));
process.env.APP_ROOT = e.join(d, "..");
const s = process.env.VITE_DEV_SERVER_URL, E = e.join(process.env.APP_ROOT, "dist-electron"), a = e.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = s ? e.join(process.env.APP_ROOT, "public") : a;
let i, t;
const p = () => e.join(o.getPath("userData"), "kitchen-orders.json");
function w() {
  try {
    const n = p();
    if (!c.existsSync(n)) return null;
    const r = JSON.parse(c.readFileSync(n, "utf8"));
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
function P(n) {
  if (!Array.isArray(n)) return;
  const r = p();
  c.mkdirSync(e.dirname(r), { recursive: !0 }), c.writeFileSync(r, JSON.stringify(n, null, 2), "utf8");
}
function R() {
  t && !t.isDestroyed() || (t = new l({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "POSphere - Kitchen Display",
    backgroundColor: "#182126",
    webPreferences: { preload: e.join(d, "preload.mjs") }
  }), t.on("closed", () => {
    t = null;
  }), s ? t.loadURL(`${s}#kitchen`) : t.loadFile(e.join(a, "index.html"), { hash: "kitchen" }));
}
function u() {
  i = new l({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: "POSphere - Point of Sale",
    backgroundColor: "#f5f7f6",
    icon: e.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: e.join(d, "preload.mjs")
    }
  }), i.webContents.on("did-finish-load", () => {
    i == null || i.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s ? i.loadURL(s) : i.loadFile(e.join(a, "index.html")), R();
}
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), i = null);
});
o.on("activate", () => {
  l.getAllWindows().length === 0 && u();
});
o.whenReady().then(() => {
  f.on("kitchen-orders-read", (n) => {
    n.returnValue = w();
  }), f.on("kitchen-orders-write", (n, r) => {
    P(r), l.getAllWindows().forEach((h) => {
      h.isDestroyed() || h.webContents.send("kitchen-orders-updated");
    });
  }), u();
});
export {
  E as MAIN_DIST,
  a as RENDERER_DIST,
  s as VITE_DEV_SERVER_URL
};
