import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import "./simulator.css";

type Variant = { id: string; name: string; sku: string; price: number };
type AddOn = { id: string; name: string; price: number };
type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  variants: Variant[];
};
type Catalog = {
  outlet: { id: string; name: string; code: string };
  table: { id: string; number: number; name: string; status: string };
  categories: string[];
  products: Product[];
  add_ons: AddOn[];
};
type CartItem = {
  key: string;
  product: Product;
  variant: Variant | null;
  quantity: number;
  addOns: AddOn[];
  notes: string;
};
type PaymentMethod =
  | "qris"
  | "gopay"
  | "bank_transfer"
  | "cstore"
  | "cardless_credit"
  | "credit_card";
const paymentMethods: Array<{
  id: PaymentMethod;
  icon: string;
  name: string;
  detail: string;
}> = [
  {
    id: "qris",
    icon: "QR",
    name: "QRIS",
    detail: "Scan QR dari mobile banking atau e-wallet",
  },
  {
    id: "gopay",
    icon: "EW",
    name: "E-Wallet / Deeplink",
    detail: "GoPay dan dompet digital",
  },
  {
    id: "bank_transfer",
    icon: "VA",
    name: "Virtual Account",
    detail: "BCA, BNI, BRI, Mandiri, Permata",
  },
  {
    id: "credit_card",
    icon: "CC",
    name: "Kartu Debit / Kredit",
    detail: "Simulasi pembayaran kartu",
  },
  {
    id: "cstore",
    icon: "OT",
    name: "Over The Counter",
    detail: "Indomaret atau Alfamart",
  },
  {
    id: "cardless_credit",
    icon: "PL",
    name: "Cardless Credit",
    detail: "PayLater dan cicilan tanpa kartu",
  },
];
type Receipt = {
  access_token?: string;
  order: {
    id: string;
    order_number: string;
    payment_status: string;
    production_status: string;
    subtotal: number;
    tax_total: number;
    grand_total: number;
    ordered_at: string;
    table_number: number;
  };
  items: Array<{
    id: string;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  payment?: { method: PaymentMethod; provider: string; paid_at: string } | null;
};
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
const tokenFromUrl = () => {
  const match = location.pathname.match(/\/table\/([^/]+)/);
  return match?.[1] || new URLSearchParams(location.search).get("token") || "";
};

export default function App() {
  const token = tokenFromUrl();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [notes, setNotes] = useState("");
  const [screen, setScreen] = useState<"menu" | "cart" | "pay" | "receipt">(
    "menu",
  );
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorMethod, setSimulatorMethod] = useState<PaymentMethod>("qris");
  useEffect(() => {
    if (!token) {
      setError(
        "Token QR meja tidak ditemukan. Scan kembali QR yang ada di meja.",
      );
      setLoading(false);
      return;
    }
    fetch(`${API}/api/customer/tables/${token}/catalog`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.message || "QR meja tidak valid.");
        return b;
      })
      .then(setCatalog)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  const visible = useMemo(
    () =>
      catalog?.products.filter(
        (p) =>
          (category === "Semua" || p.category === category) &&
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
      ) || [],
    [catalog, category, query],
  );
  const total = cart.reduce(
    (sum, item) =>
      sum +
      ((item.variant?.price || item.product.price) +
        item.addOns.reduce((a, b) => a + b.price, 0)) *
        item.quantity,
    0,
  );
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const openProduct = (p: Product) => {
    setSelected(p);
    setVariant(p.variants[0] || null);
    setAddOns([]);
    setNotes("");
  };
  const add = () => {
    if (!selected) return;
    const key = `${selected.id}:${variant?.id || "default"}:${addOns
      .map((a) => a.id)
      .sort()
      .join(",")}`;
    setCart((items) => {
      const found = items.find((i) => i.key === key);
      return found
        ? items.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [
            ...items,
            { key, product: selected, variant, quantity: 1, addOns, notes },
          ];
    });
    setSelected(null);
  };
  const quantity = (key: string, d: number) =>
    setCart((items) =>
      items
        .map((i) => (i.key === key ? { ...i, quantity: i.quantity + d } : i))
        .filter((i) => i.quantity > 0),
    );
  const checkout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await fetch(
        `${API}/api/customer/tables/${token}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            items: cart.map((i) => ({
              product_id: i.product.id,
              variant_id: i.variant?.id || null,
              quantity: i.quantity,
              add_on_ids: i.addOns.map((a) => a.id),
              notes: i.notes || null,
            })),
          }),
        },
      );
      const body = await created.json();
      if (!created.ok)
        throw new Error(
          body.message ||
            Object.values(body.errors || {})[0] ||
            "Pesanan gagal dibuat.",
        );
      setReceipt(body);
      setScreen("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pesanan gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  };
  const pay = async () => {
    if (!receipt) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/customer/orders/${receipt.order.id}/midtrans`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ access_token: receipt.access_token }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Midtrans Sandbox gagal dibuka.");
      if (body.already_paid) {
        setReceipt({ ...body, access_token: receipt.access_token });
        setScreen("receipt");
        setCart([]);
        return;
      }
      if (body.local_simulator) {
        setSimulatorOpen(true);
        setSubmitting(false);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          "script[data-midtrans-snap]",
        );
        if (existing && window.snap) return resolve();
        const script = document.createElement("script");
        script.src = body.snap_url;
        script.dataset.clientKey = body.client_key;
        script.dataset.midtransSnap = "true";
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Script Midtrans tidak dapat dimuat."));
        document.head.appendChild(script);
      });
      if (!window.snap) throw new Error("Midtrans Snap tidak tersedia.");
      window.snap.pay(body.snap_token, {
        onSuccess: async () => {
          try {
            const verify = await fetch(
              `${API}/api/customer/orders/${receipt.order.id}/midtrans/verify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ access_token: receipt.access_token }),
              },
            );
            const verified = await verify.json();
            if (!verify.ok)
              throw new Error(
                verified.message || "Status pembayaran belum terverifikasi.",
              );
            setReceipt({ ...verified, access_token: receipt.access_token });
            setScreen("receipt");
            setCart([]);
            setError("");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Verifikasi pembayaran gagal.",
            );
          } finally {
            setSubmitting(false);
          }
        },
        onPending: () => {
          setError(
            "Pembayaran masih menunggu penyelesaian di simulator Midtrans.",
          );
          setSubmitting(false);
        },
        onError: () => {
          setError("Pembayaran ditolak atau gagal diproses Midtrans.");
          setSubmitting(false);
        },
        onClose: () => {
          setError("Jendela pembayaran ditutup sebelum transaksi selesai.");
          setSubmitting(false);
        },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Midtrans Sandbox gagal dibuka.",
      );
      setSubmitting(false);
    }
  };
  const simulate = async (result: "success" | "pending" | "failed") => {
    if (!receipt) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/customer/orders/${receipt.order.id}/midtrans/simulate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            access_token: receipt.access_token,
            result,
            payment_method: simulatorMethod,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Simulasi pembayaran gagal.");
      setReceipt({ ...body, access_token: receipt.access_token });
      setSimulatorOpen(false);
      setScreen("receipt");
      setCart([]);
    } catch (e) {
      setSimulatorOpen(false);
      setError(e instanceof Error ? e.message : "Simulasi pembayaran gagal.");
    } finally {
      setSubmitting(false);
    }
  };
  if (loading)
    return (
      <main className="state">
        <span className="loader" />
        <h2>Menyiapkan menu...</h2>
        <p>Menghubungkan meja dengan restoran.</p>
      </main>
    );
  if (error && !catalog)
    return (
      <main className="state error">
        <b>!</b>
        <h2>Menu tidak dapat dibuka</h2>
        <p>{error}</p>
      </main>
    );
  if (!catalog) return null;
  return (
    <main className="app">
      <header className="top">
        <div className="brand">
          <b>P</b>
          <span>
            POS<strong>phere</strong>
            <small>SELF SERVICE</small>
          </span>
        </div>
        <div className="table">
          <UtensilsCrossed />
          <span>
            <small>NOMOR MEJA</small>
            <strong>{catalog.table.number}</strong>
          </span>
        </div>
      </header>
      {screen === "menu" && (
        <>
          <section className="hero">
            <span>
              <Store /> {catalog.outlet.name}
            </span>
            <h1>
              Mau makan
              <br />
              <b>apa hari ini?</b>
            </h1>
            <p>
              Pilih menu favoritmu, bayar dari sini, dan pesanan langsung dibuat
              kitchen.
            </p>
          </section>
          <div className="search">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari burger, minuman, paket..."
            />
          </div>
          <nav className="categories">
            {["Semua", ...catalog.categories].map((c) => (
              <button
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
                key={c}
              >
                {c}
              </button>
            ))}
          </nav>
          <section className="products">
            {visible.map((p) => (
              <button
                className="product"
                key={p.id}
                onClick={() => openProduct(p)}
              >
                <div className="photo">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" />
                  ) : (
                    <span>
                      {p.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <small>{p.category}</small>
                  <h3>{p.name}</h3>
                  <p>{p.sku}</p>
                  <strong>{rupiah(p.variants[0]?.price || p.price)}</strong>
                </div>
                <i>
                  <Plus />
                </i>
              </button>
            ))}
          </section>
        </>
      )}
      {screen === "cart" && (
        <section className="page">
          <button className="back" onClick={() => setScreen("menu")}>
            <ChevronLeft /> Kembali ke menu
          </button>
          <h1>Keranjang Pesanan</h1>
          <p>
            Meja {catalog.table.number} • {catalog.outlet.name}
          </p>
          <div className="cart-list">
            {cart.map((i) => (
              <article key={i.key}>
                <div>
                  <b>{i.product.name}</b>
                  <span>
                    {i.variant && `Ukuran ${i.variant.name}`}
                    {i.addOns.length
                      ? ` • ${i.addOns.map((a) => a.name).join(", ")}`
                      : ""}
                  </span>
                  <strong>
                    {rupiah(
                      ((i.variant?.price || i.product.price) +
                        i.addOns.reduce((s, a) => s + a.price, 0)) *
                        i.quantity,
                    )}
                  </strong>
                </div>
                <div className="qty">
                  <button onClick={() => quantity(i.key, -1)}>
                    <Minus />
                  </button>
                  <b>{i.quantity}</b>
                  <button onClick={() => quantity(i.key, 1)}>
                    <Plus />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {error && <div className="alert">{error}</div>}
          <div className="summary">
            <span>
              Subtotal <b>{rupiah(total)}</b>
            </span>
            <span>
              PB1 11% <b>{rupiah(Math.round(total * 0.11))}</b>
            </span>
            <strong>
              Total <b>{rupiah(Math.round(total * 1.11))}</b>
            </strong>
            <button disabled={submitting} onClick={checkout}>
              {submitting ? "Membuat pesanan..." : "Buat Pesanan & Bayar"}
            </button>
          </div>
        </section>
      )}
      {screen === "pay" && receipt && (
        <section className="page payment">
          <span className="step">PESANAN {receipt.order.order_number}</span>
          <h1>Simulator Pembayaran</h1>
          <p>
            Gunakan simulator lokal untuk mencoba alur sukses, pending, dan
            gagal tanpa akun payment gateway.
          </p>
          <div className="pay-total">
            <small>TOTAL TAGIHAN • MEJA {catalog.table.number}</small>
            <strong>{rupiah(Number(receipt.order.grand_total))}</strong>
          </div>
          {error && <div className="alert">{error}</div>}
          <div className="methods">
            <button disabled={submitting} onClick={pay}>
              <b>MT</b>
              <span>
                <strong>
                  {submitting
                    ? "Membuka Midtrans..."
                    : "Buka Simulator Pembayaran"}
                </strong>
                <small>
                  Pilih QRIS, e-wallet, kartu, atau virtual account di Snap
                </small>
              </span>
            </button>
          </div>
          <em>Mode lokal development • tidak memotong uang sungguhan.</em>
        </section>
      )}
      {screen === "receipt" && receipt && (
        <section className="page receipt">
          <CheckCircle2 />
          <span className="step">PEMBAYARAN BERHASIL</span>
          <h1>Pesanan masuk kitchen!</h1>
          <p>Simpan nota ini untuk melihat nomor pesananmu.</p>
          <div className="receipt-card">
            <header>
              <div className="brand">
                <b>P</b>
                <span>
                  POS<strong>phere</strong>
                </span>
              </div>
              <small>{catalog.outlet.name}</small>
            </header>
            <div className="receipt-number">
              <small>NOMOR PESANAN</small>
              <strong>{receipt.order.order_number}</strong>
              <span>MEJA {catalog.table.number}</span>
            </div>
            {receipt.items.map((i) => (
              <div className="receipt-line" key={i.id}>
                <span>
                  {Number(i.quantity)}× {i.product_name_snapshot}
                  {i.variant_name_snapshot
                    ? ` (${i.variant_name_snapshot})`
                    : ""}
                </span>
                <b>{rupiah(Number(i.line_total))}</b>
              </div>
            ))}
            {receipt.payment && (
              <div className="receipt-line payment-method-line">
                <span>Metode pembayaran</span>
                <b>
                  {paymentMethods.find(
                    (item) => item.id === receipt.payment?.method,
                  )?.name || receipt.payment.method}
                </b>
              </div>
            )}
            <footer>
              <span>Total</span>
              <strong>{rupiah(Number(receipt.order.grand_total))}</strong>
            </footer>
          </div>
          <div className="tracking">
            <Clock3 />
            <span>
              <b>Status pesanan</b>
              <small>Menunggu kitchen mulai menyiapkan</small>
            </span>
          </div>
        </section>
      )}
      {selected && (
        <div className="sheet-bg" onClick={() => setSelected(null)}>
          <section className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            <small>{selected.category}</small>
            <h2>{selected.name}</h2>
            <p>{selected.sku}</p>
            {selected.variants.length > 0 && (
              <div className="options">
                <b>Pilih ukuran</b>
                {selected.variants.map((v) => (
                  <button
                    className={variant?.id === v.id ? "active" : ""}
                    onClick={() => setVariant(v)}
                    key={v.id}
                  >
                    <span>{v.name}</span>
                    <strong>{rupiah(v.price)}</strong>
                  </button>
                ))}
              </div>
            )}
            {catalog.add_ons.length > 0 && (
              <div className="options">
                <b>Tambahan</b>
                {catalog.add_ons.map((a) => (
                  <button
                    className={
                      addOns.some((x) => x.id === a.id) ? "active" : ""
                    }
                    onClick={() =>
                      setAddOns((x) =>
                        x.some((y) => y.id === a.id)
                          ? x.filter((y) => y.id !== a.id)
                          : [...x, a],
                      )
                    }
                    key={a.id}
                  >
                    <span>{a.name}</span>
                    <strong>+{rupiah(a.price)}</strong>
                  </button>
                ))}
              </div>
            )}
            <label>
              Catatan
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: tanpa saus, tidak pedas..."
              />
            </label>
            <button className="add" onClick={add}>
              Tambah •{" "}
              {rupiah(
                (variant?.price || selected.price) +
                  addOns.reduce((s, a) => s + a.price, 0),
              )}
            </button>
          </section>
        </div>
      )}
      {simulatorOpen && receipt && (
        <div className="simulator-backdrop">
          <section className="simulator">
            <header>
              <span>PS</span>
              <div>
                <b>POSphere Payment Simulator</b>
                <small>LOCAL DEVELOPMENT MODE</small>
              </div>
              <button onClick={() => setSimulatorOpen(false)}>×</button>
            </header>
            <div className="simulator-body">
              <span className="simulator-badge">MOCK MIDTRANS</span>
              <h2>Simulasikan pembayaran</h2>
              <p>
                Simulator lokal, bukan layanan resmi Midtrans dan tidak
                menggunakan uang sungguhan.
              </p>
              <strong className="simulator-label">
                PILIH JENIS PEMBAYARAN
              </strong>
              <div className="simulator-methods">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    className={simulatorMethod === method.id ? "active" : ""}
                    onClick={() => setSimulatorMethod(method.id)}
                    type="button"
                  >
                    <b>{method.icon}</b>
                    <span>
                      <strong>{method.name}</strong>
                      <small>{method.detail}</small>
                    </span>
                    <i>{simulatorMethod === method.id ? "✓" : ""}</i>
                  </button>
                ))}
              </div>
              <div className="simulator-amount">
                <small>TOTAL PEMBAYARAN • MEJA {catalog.table.number}</small>
                <strong>{rupiah(Number(receipt.order.grand_total))}</strong>
                <span>
                  {
                    paymentMethods.find((item) => item.id === simulatorMethod)
                      ?.name
                  }{" "}
                  • {receipt.order.order_number}
                </span>
              </div>
              <button
                className="sim-success"
                disabled={submitting}
                onClick={() => simulate("success")}
              >
                <b>✓ Pembayaran Berhasil</b>
                <small>Status lunas dan kirim ke Kitchen Display</small>
              </button>
              <button
                className="sim-pending"
                disabled={submitting}
                onClick={() => simulate("pending")}
              >
                <b>◷ Pembayaran Pending</b>
                <small>Pesanan belum masuk kitchen</small>
              </button>
              <button
                className="sim-failed"
                disabled={submitting}
                onClick={() => simulate("failed")}
              >
                <b>× Pembayaran Gagal</b>
                <small>Transaksi ditolak dan dapat dicoba lagi</small>
              </button>
            </div>
            <footer>
              Khusus pengujian lokal • Nonaktifkan sebelum production
            </footer>
          </section>
        </div>
      )}
      {count > 0 && screen === "menu" && (
        <button className="floating-cart" onClick={() => setScreen("cart")}>
          <span>
            <ShoppingBag />
            <b>{count}</b>
          </span>
          <strong>Lihat Keranjang</strong>
          <b>{rupiah(total)}</b>
        </button>
      )}
    </main>
  );
}
