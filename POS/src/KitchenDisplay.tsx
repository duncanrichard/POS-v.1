import { useEffect, useState } from "react";
import {
  KitchenOrder,
  KitchenStatus,
  readKitchenOrders,
  writeKitchenOrders,
} from "./kitchenStore";
import "./KitchenDisplay.css";
import "./KitchenCompact.css";
import "./KitchenTableNumber.css";

const elapsed = (date: string, now: number) => {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(date).getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return hours ? `${String(hours).padStart(2, "0")}:${clock}` : clock;
};
const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export default function KitchenDisplay() {
  const [orders, setOrders] = useState(readKitchenOrders);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | KitchenStatus>("all");
  useEffect(() => {
    const bus = new BroadcastChannel("posphere-kitchen");
    const refresh = () => setOrders(readKitchenOrders());
    const ipcRefresh = () => refresh();
    bus.onmessage = refresh;
    window.addEventListener("storage", refresh);
    window.ipcRenderer?.on("kitchen-orders-updated", ipcRefresh);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      bus.close();
      window.removeEventListener("storage", refresh);
      window.ipcRenderer?.off("kitchen-orders-updated", ipcRefresh);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const refreshServer = async () => {
      try {
        const session = JSON.parse(
          localStorage.getItem("posphere.posSession") || "null",
        );
        if (!session?.token) return;
        const base = (
          import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
        ).replace(/\/$/, "");
        const response = await fetch(`${base}/api/pos/kitchen/tickets`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`,
          },
        });
        if (!response.ok) return;
        const body = await response.json();
        const serverOrders: KitchenOrder[] = body.tickets.map(
          (ticket: any) => ({
            id: `server:${ticket.id}`,
            serverTicketId: ticket.id,
            number: ticket.order_number,
            status: ticket.status === "queued" ? "fixed" : ticket.status,
            createdAt: ticket.queued_at,
            fixedAt: ticket.queued_at,
            completedAt: ticket.ready_at || undefined,
            orderType: ticket.order_type,
            tableNumber: ticket.table_number
              ? Number(ticket.table_number)
              : undefined,
            source: ticket.source,
            items: ticket.items.map((item: any) => ({
              name: item.name,
              size: item.variant || undefined,
              quantity: Number(item.quantity),
              note: item.notes || undefined,
            })),
          }),
        );
        setOrders([
          ...serverOrders,
          ...readKitchenOrders().filter(
            (item) =>
              !serverOrders.some((server) => server.number === item.number),
          ),
        ]);
      } catch {
        /* keep local queue available while server is offline */
      }
    };
    void refreshServer();
    const timer = window.setInterval(refreshServer, 3000);
    return () => window.clearInterval(timer);
  }, []);
  const update = async (id: string, status: KitchenStatus) => {
    const current = orders.find((order) => order.id === id);
    if (
      current?.serverTicketId &&
      (status === "preparing" || status === "ready")
    ) {
      const session = JSON.parse(
        localStorage.getItem("posphere.posSession") || "null",
      );
      const base = (
        import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
      ).replace(/\/$/, "");
      const response = await fetch(
        `${base}/api/pos/kitchen/tickets/${current.serverTicketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session?.token || ""}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) return;
    }
    const next = orders.map((order) =>
      order.id === id
        ? {
            ...order,
            status,
            ...(status === "ready"
              ? { completedAt: new Date().toISOString() }
              : {}),
          }
        : order,
    );
    setOrders(next);
    if (!current?.serverTicketId) writeKitchenOrders(next);
  };
  const todayOrders = orders.filter(
    (order) => (order.businessDate || todayKey()) === todayKey(),
  );
  const active = todayOrders
    .filter((order) => order.status !== "ready")
    .sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );
  const completed = todayOrders
    .filter((order) => order.status === "ready")
    .sort(
      (first, second) =>
        new Date(second.completedAt || second.createdAt).getTime() -
        new Date(first.completedAt || first.createdAt).getTime(),
    );
  const visible =
    filter === "ready"
      ? completed
      : active.filter((order) => filter === "all" || order.status === filter);
  const count = (status: KitchenStatus) =>
    todayOrders.filter((order) => order.status === status).length;
  const filterTitle =
    filter === "all"
      ? "Semua Antrean Aktif"
      : filter === "draft"
        ? "Menunggu Konfirmasi Kasir"
        : filter === "fixed"
          ? "Pesanan Siap Dibuat"
          : filter === "preparing"
            ? "Sedang Diproses"
            : "Pesanan Selesai Hari Ini";

  return (
    <main className="kds">
      <header>
        <div className="kds-brand">
          <span>K</span>
          <div>
            <b>POSPHERE KITCHEN</b>
            <h1>Kitchen Display</h1>
          </div>
        </div>
        <nav>
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            <b>{active.length}</b>
            <span>Semua</span>
          </button>
          <button
            className={`draft ${filter === "draft" ? "active" : ""}`}
            onClick={() => setFilter("draft")}
          >
            <b>{count("draft")}</b>
            <span>Belum Fix</span>
          </button>
          <button
            className={`fixed ${filter === "fixed" ? "active" : ""}`}
            onClick={() => setFilter("fixed")}
          >
            <b>{count("fixed")}</b>
            <span>Siap Dibuat</span>
          </button>
          <button
            className={`preparing ${filter === "preparing" ? "active" : ""}`}
            onClick={() => setFilter("preparing")}
          >
            <b>{count("preparing")}</b>
            <span>Diproses</span>
          </button>
          <button
            className={`ready ${filter === "ready" ? "active" : ""}`}
            onClick={() => setFilter("ready")}
          >
            <b>{count("ready")}</b>
            <span>Selesai</span>
          </button>
        </nav>
        <div className="kds-clock">
          <small>WAKTU SEKARANG</small>
          <time>
            {new Intl.DateTimeFormat("id-ID", { timeStyle: "medium" }).format(
              now,
            )}
          </time>
        </div>
      </header>
      <div className="kds-subhead">
        <strong>{filterTitle}</strong>
        <span>
          {filter === "ready"
            ? "Riwayat pesanan yang selesai dibuat hari ini"
            : "Sentuh tombol pada kartu untuk memperbarui status"}
        </span>
      </div>
      <section className="kds-grid">
        {visible.map((order) => {
          const timerEnd =
            order.status === "ready" && order.completedAt
              ? new Date(order.completedAt).getTime()
              : now;
          const minutes = Math.floor(
            (timerEnd - new Date(order.fixedAt || order.createdAt).getTime()) /
              60000,
          );
          return (
            <article
              key={order.id}
              className={`kds-card ${order.status} ${order.status !== "ready" && minutes >= 10 ? "late" : ""}`}
            >
              <div className="kds-card-head">
                <div>
                  <small>
                    {order.status === "draft"
                      ? "BELUM FIX"
                      : order.status === "fixed"
                        ? "SIAP DIBUAT"
                        : order.status === "preparing"
                          ? "SEDANG DIBUAT"
                          : "SELESAI"}
                  </small>
                  <h2>#{order.number}</h2>
                  <div className="kds-order-meta">
                    <span>{order.source === "self_service" ? "SELF SERVICE" : order.orderType}</span>
                    {(order.tableNumber || order.orderType.toLowerCase().includes("dine")) && (
                      <b className="kds-table-number"><small>NO. MEJA</small><strong>{order.tableNumber ?? "-"}</strong></b>
                    )}
                  </div>
                </div>
                <div className="kds-timer">
                  <small>{order.status === "ready" ? "DURASI" : "WAKTU"}</small>
                  <strong>
                    {elapsed(order.fixedAt || order.createdAt, timerEnd)}
                  </strong>
                </div>
              </div>
              <div className="kds-items">
                {order.items.map((item, index) => (
                  <section key={index}>
                    <div className="kds-item-main">
                      <strong>{item.quantity}×</strong>
                      <h3>{item.name}</h3>
                      {item.size && <b>{item.size}</b>}
                    </div>
                    {Boolean(item.addons?.length) && (
                      <div className="kds-addons">
                        {item.addons?.map((addon) => {
                          const removed =
                            addon.startsWith("NO ") ||
                            addon.startsWith("TANPA ");
                          return (
                            <span
                              className={removed ? "removed" : "added"}
                              key={addon}
                            >
                              {removed ? addon : `+ ${addon}`}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {item.note && (
                      <em>
                        <b>CATATAN</b>
                        {item.note}
                      </em>
                    )}
                  </section>
                ))}
              </div>
              <footer>
                {order.status === "draft" ? (
                  <button disabled>
                    <span>○</span> Menunggu Kasir Fix
                  </button>
                ) : order.status === "fixed" ? (
                  <button onClick={() => update(order.id, "preparing")}>
                    <span>▶</span> Mulai Buat
                  </button>
                ) : order.status === "preparing" ? (
                  <button onClick={() => update(order.id, "ready")}>
                    <span>✓</span> Tandai Pesanan Siap
                  </button>
                ) : (
                  <button disabled className="completed">
                    <span>✓</span> Pesanan Selesai
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </section>
      {!visible.length && (
        <div className="kds-empty">
          <b>✓</b>
          <h2>
            {filter === "ready"
              ? "Belum ada pesanan selesai"
              : "Tidak ada antrean"}
          </h2>
          <p>
            {filter === "ready"
              ? "Pesanan yang ditandai siap akan muncul di sini."
              : "Pesanan baru dari kasir akan muncul otomatis di layar ini."}
          </p>
        </div>
      )}
    </main>
  );
}
