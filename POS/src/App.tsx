import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import "./ModernPOS.css";
import "./TableManagement.css";
import "./PosPaymentSimulator.css";
import { upsertKitchenOrder } from "./kitchenStore";

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  normalPrice: number;
  imageUrl: string | null;
  productType: "ala_carte" | "bundle";
  description?: string;
  badge?: string;
  variants: Array<{ id: string; sku: string; name: string; price: number }>;
  variantId?: string;
  size?: string;
  removableIngredients: Array<{ id: string; name: string }>;
};

type AddOn = { id: string; code: string; name: string; price: number };
type DiningTable = {
  id: string;
  table_number: number;
  code: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "inactive";
};
type ItemDiscount = {
  id: string;
  label: string;
  type: "percent" | "amount";
  value: number;
};

type CartItem = Product & {
  quantity: number;
  cartKey: string;
  pricingLabel: string;
  note?: string;
  addons?: AddOn[];
  removedIngredients?: Array<{ id: string; name: string }>;
  discounts?: ItemDiscount[];
};

type CatalogResponse = {
  outlet: { id: string; code: string; name: string };
  categories: string[];
  products: Array<{
    id: string;
    product_type: "ala_carte" | "bundle";
    sku: string;
    name: string;
    category: string;
    price: number;
    normal_price: number;
    image_url: string | null;
    promotion_name: string | null;
    description?: string;
    variants?: Array<{ id: string; sku: string; name: string; price: number }>;
    removable_ingredients?: Array<{ id: string; name: string }>;
  }>;
  add_ons: AddOn[];
  tables: DiningTable[];
};

type Receipt = {
  serverOrderId?: string;
  number: string;
  paidAt: Date;
  status: "LUNAS" | "BELUM LUNAS";
  orderType: string;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const OUTLET_CODE = import.meta.env.VITE_OUTLET_CODE || "STR-0001";
const ORDER_SEQUENCE_KEY = "posphere.orderSequence";
const ACTIVE_ORDER_KEY = "posphere.activeOrderNumber";
const currentOrderNumber = () => {
  const active = sessionStorage.getItem(ACTIVE_ORDER_KEY);
  if (active) return active;
  const sequence =
    Math.max(127, Number(localStorage.getItem(ORDER_SEQUENCE_KEY) || 127)) + 1;
  const number = String(sequence).padStart(6, "0");
  localStorage.setItem(ORDER_SEQUENCE_KEY, String(sequence));
  sessionStorage.setItem(ACTIVE_ORDER_KEY, number);
  return number;
};
const nextOrderNumber = () => {
  const sequence =
    Math.max(127, Number(localStorage.getItem(ORDER_SEQUENCE_KEY) || 127)) + 1;
  const number = String(sequence).padStart(6, "0");
  localStorage.setItem(ORDER_SEQUENCE_KEY, String(sequence));
  sessionStorage.setItem(ACTIVE_ORDER_KEY, number);
  return number;
};

const formatRupiah = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
const discountedPrice = (price: number, discounts: ItemDiscount[] = []) =>
  discounts.reduce((current, rule) => {
    const reduction =
      rule.type === "percent"
        ? Math.round((current * Math.min(100, rule.value)) / 100)
        : rule.value;
    return Math.max(0, current - reduction);
  }, price);
const itemDiscountValue = (item: CartItem) =>
  Math.max(0, item.price - discountedPrice(item.price, item.discounts));
type PosSession = {
  token: string;
  user: { id: string | number; name: string; email: string };
  outlet: { id: string; code: string; name: string };
};
type SelfServiceOrder = {
  id: string;
  order_number: string;
  payment_status: string;
  production_status: string;
  grand_total: number;
  ordered_at: string;
  table_number: number;
  table_status: "available" | "occupied" | "inactive";
  table_session_status: "open" | "closed";
  items: Array<{
    id: string;
    name: string;
    variant?: string;
    quantity: number;
    notes?: string;
  }>;
};
type ManagedTable = DiningTable & {
  open_session_count: number;
  open_order_count: number;
  unpaid_order_count: number;
};
type PosRegister = { id: string; code: string; name: string };
type PosShift = {
  id: string;
  shift_number: string;
  status: string;
  register_code: string;
  register_name: string;
  cashier_name?: string;
  opening_cash: string | number;
  expected_cash?: string | number;
  actual_cash?: string | number;
  cash_variance?: string | number;
  opened_at: string;
  closed_at?: string;
  total_orders?: number;
  gross_sales?: number;
  discount_total?: number;
  tax_total?: number;
  paid_total?: number;
  payment_summary?: Array<{
    method: string;
    transaction_count: number;
    total: number;
  }>;
  order_type_summary?: Array<{
    order_type: string;
    transaction_count: number;
    total: number;
  }>;
};
type ActiveOrderSnapshot = {
  version: 1;
  outletId: string;
  orderNumber: string;
  orderType: string;
  cart: CartItem[];
  selectedCartKey: string;
  discountPercent: number;
  couponValue: number;
  kitchenOrderId: string;
  kitchenCreatedAt: string;
  savedAt: string;
  diningTable?: DiningTable | null;
};
const ACTIVE_ORDER_SNAPSHOT_KEY = "posphere.activeOrder";
const readActiveOrder = (): ActiveOrderSnapshot | null => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(ACTIVE_ORDER_SNAPSHOT_KEY) || "null",
    ) as ActiveOrderSnapshot | null;
    return saved?.version === 1 && Array.isArray(saved.cart) ? saved : null;
  } catch {
    return null;
  }
};

function LegacyPosLogin({
  onLogin,
}: {
  onLogin: (session: PosSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/pos/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.errors?.email?.[0] || body.message || "Login POS gagal.",
        );
      localStorage.setItem("posphere.posSession", JSON.stringify(body));
      onLogin(body);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="pos-login">
      <section className="pos-login-brand">
        <div className="brand-mark">P</div>
        <h1>
          POS<span>phere</span>
        </h1>
        <p>Point of Sale untuk operasional cabang</p>
        <div>
          <b>✓</b>
          <span>Akun kasir mengikuti cabang dari Backoffice.</span>
        </div>
        <div>
          <b>✓</b>
          <span>Produk, harga, dan kitchen tersinkronisasi otomatis.</span>
        </div>
      </section>
      <section className="pos-login-panel">
        <form onSubmit={submit}>
          <small>LOGIN POS KASIR</small>
          <h2>Masuk ke Register</h2>
          <p>Gunakan akun POS dari menu Setting Backoffice.</p>
          {error && <div className="pos-login-error">! {error}</div>}
          <label>
            Email akun
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button disabled={loading}>
            {loading ? "Memverifikasi..." : "Masuk ke POS"}
          </button>
          <footer>Cabang dipilih otomatis berdasarkan akun.</footer>
        </form>
      </section>
    </main>
  );
}

function PosLogin({ onLogin }: { onLogin: (session: PosSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/pos/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.errors?.email?.[0] || body.message || "Login POS gagal.",
        );
      localStorage.setItem("posphere.posSession", JSON.stringify(body));
      onLogin(body);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="pos-login">
      <section className="pos-login-brand">
        <div className="brand-mark">P</div>
        <h1>
          POS<span>phere</span>
        </h1>
        <p>Point of Sale untuk operasional cabang</p>
        <div>
          <b>✓</b>
          <span>Akun kasir mengikuti cabang dari Backoffice.</span>
        </div>
        <div>
          <b>✓</b>
          <span>Produk, harga, dan kitchen tersinkronisasi otomatis.</span>
        </div>
      </section>
      <section className="pos-login-panel">
        <form onSubmit={submit}>
          <small>LOGIN POS KASIR</small>
          <h2>Masuk ke Register</h2>
          <p>Gunakan akun POS dari menu Setting Backoffice.</p>
          {error && <div className="pos-login-error">! {error}</div>}
          <label>
            Email akun
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button disabled={loading}>
            {loading ? "Memverifikasi..." : "Masuk ke POS"}
          </button>
          <div className="default-login">
            <strong>Akun POS default</strong>
            <button
              type="button"
              onClick={() => {
                setEmail("cashier@posphere.id");
                setPassword("Posphere123!");
              }}
            >
              <span>
                <small>Username</small>
                <b>cashier@posphere.id</b>
              </span>
              <span>
                <small>Password</small>
                <b>Posphere123!</b>
              </span>
              <em>Klik untuk isi otomatis</em>
            </button>
          </div>
          <footer>Cabang dipilih otomatis berdasarkan akun.</footer>
        </form>
      </section>
    </main>
  );
}

void LegacyPosLogin;
void PosLogin;

function FnbPosLogin({ onLogin }: { onLogin: (session: PosSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/pos/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.errors?.email?.[0] || body.message || "Login POS gagal.",
        );
      localStorage.setItem("posphere.posSession", JSON.stringify(body));
      onLogin(body);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Tidak dapat terhubung ke server backoffice.",
      );
    } finally {
      setLoading(false);
    }
  };
  const useDefaultAccount = () => {
    setEmail("cashier@posphere.id");
    setPassword("Posphere123!");
    setError("");
  };
  return (
    <main className="fnb-login">
      <section className="fnb-login-visual">
        <header>
          <div className="fnb-logo-mark">P</div>
          <div className="fnb-logo">
            POS<span>phere</span>
            <small>FOOD & BEVERAGE POS</small>
          </div>
        </header>
        <div className="fnb-hero-copy">
          <p>OPERASIONAL RESTORAN TERINTEGRASI</p>
          <h1>
            Layani lebih cepat.
            <br />
            <span>Kelola lebih akurat.</span>
          </h1>
          <p className="fnb-lead">
            Satu sistem untuk kasir, kitchen display, pesanan, pembayaran, dan
            laporan outlet.
          </p>
        </div>
        <div className="fnb-flow">
          <article>
            <b>01</b>
            <span>
              <strong>Buka Shift</strong>
              <small>Catat register dan modal awal</small>
            </span>
          </article>
          <article>
            <b>02</b>
            <span>
              <strong>Terima Pesanan</strong>
              <small>Dine In, Take Away, Delivery</small>
            </span>
          </article>
          <article>
            <b>03</b>
            <span>
              <strong>Kitchen Live</strong>
              <small>Pesanan tersinkron otomatis</small>
            </span>
          </article>
        </div>
        <footer>
          <span>
            <i /> Server Backoffice
          </span>
          <span>
            <i /> Kitchen Display
          </span>
          <span>
            <i /> Register POS
          </span>
        </footer>
      </section>
      <section className="fnb-login-side">
        <form onSubmit={submit}>
          <div className="fnb-form-heading">
            <div className="fnb-cashier-icon">K</div>
            <div>
              <small>AKSES KASIR</small>
              <h2>Masuk ke POS</h2>
              <p>Gunakan akun kasir yang terdaftar pada outlet.</p>
            </div>
          </div>
          {error && (
            <div className="fnb-login-error">
              <b>!</b>
              <span>{error}</span>
            </div>
          )}
          <label>
            <span>Email kasir</span>
            <div className="fnb-input">
              <b>@</b>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@posphere.id"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div className="fnb-input">
              <b>●</b>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </label>
          <button className="fnb-submit" disabled={loading}>
            {loading ? (
              <>
                <i /> Memverifikasi akun...
              </>
            ) : (
              <>
                Masuk & Buka Register <b>→</b>
              </>
            )}
          </button>
          <div className="fnb-demo">
            <div>
              <span>AKUN POS DEFAULT</span>
              <small>Untuk demo dan pengujian outlet</small>
            </div>
            <button type="button" onClick={useDefaultAccount}>
              <span>
                <small>Email</small>
                <b>cashier@posphere.id</b>
              </span>
              <span>
                <small>Password</small>
                <b>Posphere123!</b>
              </span>
              <em>Gunakan akun</em>
            </button>
          </div>
          <footer>
            <span>
              <i /> Cabang dipilih otomatis dari akun
            </span>
            <small>POSphere F&B System • Secure Login</small>
          </footer>
        </form>
      </section>
    </main>
  );
}

function Icon({
  name,
}: {
  name: "search" | "cart" | "trash" | "more" | "menu" | "receipt";
}) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    cart: (
      <>
        <path d="M3 3h2l2.3 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function App() {
  const [posSession, setPosSession] = useState<PosSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("posphere.posSession") || "null");
    } catch {
      return null;
    }
  });
  const [restoredOrder] = useState<ActiveOrderSnapshot | null>(() => {
    const saved = readActiveOrder();
    return saved && (!posSession || saved.outletId === posSession.outlet.id)
      ? saved
      : null;
  });
  const [category, setCategory] = useState("Semua");
  const [saleMode, setSaleMode] = useState<"ala_carte" | "bundle" | "promo">(
    "ala_carte",
  );
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState(
    restoredOrder?.orderType || "Dine In",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([]);
  const [availableTables, setAvailableTables] = useState<DiningTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(
    restoredOrder?.diningTable || null,
  );
  const [tableModal, setTableModal] = useState(false);
  const [outlet, setOutlet] = useState({
    name: "Memuat Store...",
    code: OUTLET_CODE,
  });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState<CartItem[]>(restoredOrder?.cart || []);
  const [selectedCartKey, setSelectedCartKey] = useState(
    restoredOrder?.selectedCartKey || "",
  );
  const [sizeModal, setSizeModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(
    restoredOrder?.discountPercent || 0,
  );
  const [couponValue, setCouponValue] = useState(
    restoredOrder?.couponValue || 0,
  );
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const isPaid = receipt?.status === "LUNAS";
  const [paymentStep, setPaymentStep] = useState<"confirm" | "method" | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState("Tunai");
  const [cashInput, setCashInput] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [qrisSimulationStatus, setQrisSimulationStatus] = useState<"pending" | "failed" | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Receipt[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("posphere.pendingPayments") || "[]",
      ).map((item: Receipt) => ({
        ...item,
        paidAt: new Date(item.paidAt),
        items: item.items.map((cartItem) => ({
          ...cartItem,
          addons: (cartItem.addons || []).map((addOn) =>
            typeof addOn === "string"
              ? { id: `legacy:${addOn}`, code: "LEGACY", name: addOn, price: 0 }
              : addOn,
          ),
        })),
      }));
    } catch {
      return [];
    }
  });
  const [pendingModal, setPendingModal] = useState(false);
  const [payingPendingNumber, setPayingPendingNumber] = useState("");
  const [pendingServerTotal, setPendingServerTotal] = useState<number | null>(null);
  const [sizeNotice, setSizeNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
  }>(null);
  const [itemOptionModal, setItemOptionModal] = useState(false);
  const [itemNote, setItemNote] = useState("");
  const [itemAddons, setItemAddons] = useState<AddOn[]>([]);
  const itemAddOns = itemAddons;
  const [itemRemovedIngredients, setItemRemovedIngredients] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [discountModal, setDiscountModal] = useState(false);
  const [draftDiscounts, setDraftDiscounts] = useState<ItemDiscount[]>([]);
  const [discountType, setDiscountType] =
    useState<ItemDiscount["type"]>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountLabel, setDiscountLabel] = useState("Diskon manual");
  const [kitchenOrderId, setKitchenOrderId] = useState(
    () => restoredOrder?.kitchenOrderId || crypto.randomUUID(),
  );
  const [kitchenCreatedAt, setKitchenCreatedAt] = useState(
    () => restoredOrder?.kitchenCreatedAt || new Date().toISOString(),
  );
  const [orderNumber, setOrderNumber] = useState(
    () => restoredOrder?.orderNumber || currentOrderNumber(),
  );
  const [submitting, setSubmitting] = useState(false);
  const paymentRequestLock = useRef(false);
  const [shift, setShift] = useState<PosShift | null>(null);
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [selectedRegister, setSelectedRegister] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [closingShift, setClosingShift] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [shiftReport, setShiftReport] = useState<PosShift | null>(null);
  const [selfServiceOrders, setSelfServiceOrders] = useState<
    SelfServiceOrder[]
  >([]);
  const [selfServiceOpen, setSelfServiceOpen] = useState(false);
  const [readSelfServiceIds, setReadSelfServiceIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("posphere.readSelfServiceOrders") || "[]"); } catch { return []; }
  });
  const [releasingTableId, setReleasingTableId] = useState("");
  const [selfServiceMessage, setSelfServiceMessage] = useState("");
  const [tableManagementOpen, setTableManagementOpen] = useState(false);
  const [managedTables, setManagedTables] = useState<ManagedTable[]>([]);
  const [managedTableOutlet, setManagedTableOutlet] = useState({ name: "", code: "" });
  const [tableManagementLoading, setTableManagementLoading] = useState(false);
  const [tableManagementMessage, setTableManagementMessage] = useState("");
  const [releasingManagedTableId, setReleasingManagedTableId] = useState("");
  const unreadSelfServiceOrders = selfServiceOrders.filter((order) => !readSelfServiceIds.includes(order.id));
  const toggleSelfServiceOrders = () => {
    if (!selfServiceOpen) { setSelfServiceOpen(true); return; }
    const next = Array.from(new Set([...readSelfServiceIds, ...selfServiceOrders.map((order) => order.id)])).slice(-300);
    setReadSelfServiceIds(next);
    localStorage.setItem("posphere.readSelfServiceOrders", JSON.stringify(next));
    setSelfServiceOpen(false);
  };
  const pressShiftAmount = (
    key: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (key === "C") return setter("");
    if (key === "⌫") return setter((value) => value.slice(0, -1));
    setter((value) => `${value}${key}`.replace(/^0+/, "").slice(0, 12));
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${posSession?.token || ""}`,
  });
  const loadManagedTables = async () => {
    if (!posSession) return;
    setTableManagementLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pos/tables`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Data meja gagal dimuat.");
      setManagedTables(body.tables || []);
      setManagedTableOutlet(body.outlet || posSession.outlet);
    } catch (problem) {
      setTableManagementMessage(problem instanceof Error ? problem.message : "Data meja gagal dimuat.");
    } finally {
      setTableManagementLoading(false);
    }
  };
  const openTableManagement = () => {
    setTableManagementMessage("");
    setTableManagementOpen(true);
    void loadManagedTables();
  };
  const releaseManagedTable = async (table: ManagedTable) => {
    setReleasingManagedTableId(table.id);
    setTableManagementMessage("");
    try {
      const response = await fetch(`${API_URL}/api/pos/tables/${table.id}/release`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Status meja gagal diperbarui.");
      setTableManagementMessage(body.message);
      await Promise.all([loadManagedTables(), loadCatalog(true)]);
    } catch (problem) {
      setTableManagementMessage(problem instanceof Error ? problem.message : "Status meja gagal diperbarui.");
    } finally {
      setReleasingManagedTableId("");
    }
  };
  const openOrderForTable = (table: ManagedTable) => {
    setOrderType("Dine In");
    setSelectedTable({
      id: table.id,
      table_number: table.table_number,
      code: table.code,
      name: table.name,
      capacity: table.capacity,
      status: "available",
    });
    setTableManagementOpen(false);
  };
  const loadShift = async () => {
    if (!posSession) return;
    setShiftLoading(true);
    setShiftError("");
    try {
      const response = await fetch(`${API_URL}/api/pos/shifts/current`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const body = (await response.json()) as {
        shift: PosShift | null;
        registers: PosRegister[];
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.message || "Status shift gagal dimuat.");
      setShift(body.shift);
      setRegisters(body.registers || []);
      setSelectedRegister(body.registers?.[0]?.id || "");
    } catch (problem) {
      setShiftError(
        problem instanceof Error
          ? problem.message
          : "Status shift gagal dimuat.",
      );
    } finally {
      setShiftLoading(false);
    }
  };
  const openShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setShiftError("");
    try {
      const response = await fetch(`${API_URL}/api/pos/shifts/open`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          register_id: selectedRegister,
          opening_cash: Number(openingCash || 0),
        }),
      });
      const body = (await response.json()) as {
        shift?: PosShift;
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (!response.ok || !body.shift)
        throw new Error(
          Object.values(body.errors || {})[0]?.[0] ||
            body.message ||
            "Shift gagal dibuka.",
        );
      setShift(body.shift);
      setOpeningCash("");
    } catch (problem) {
      setShiftError(
        problem instanceof Error ? problem.message : "Shift gagal dibuka.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void loadShift();
  }, [posSession?.token]);
  useEffect(() => {
    if (!posSession) return;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/pos/self-service/orders`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (response.ok)
          setSelfServiceOrders((await response.json()).orders || []);
      } catch {
        /* notification refresh retries automatically */
      }
    };
    void load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [posSession?.token]);
  const submitOrderToServer = async () => {
    if (!posSession) throw new Error("Sesi kasir tidak tersedia.");
    const response = await fetch(`${API_URL}/api/pos/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        client_order_id: kitchenOrderId,
        idempotency_key: `order:${posSession.outlet.id}:${kitchenOrderId}`,
        order_type:
          orderType === "Dine In"
            ? "dine_in"
            : orderType === "Take Away"
              ? "take_away"
              : "delivery",
        dining_table_id:
          orderType === "Dine In" ? selectedTable?.id || null : null,
        discount_total: discount,
        items: cart.map((item) => ({
          product_id: item.id,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          notes: item.note || null,
          add_on_ids: (item.addons || []).map((addOn) => addOn.id),
          removed_ingredient_ids: (item.removedIngredients || []).map(
            (ingredient) => ingredient.id,
          ),
        })),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      errors?: Record<string, string[]>;
      order?: {
        id: string;
        order_number: string;
        grand_total: string | number;
      };
    };
    if (!response.ok || !body.order)
      throw new Error(
        Object.values(body.errors || {})[0]?.[0] ||
          body.message ||
          "Pesanan gagal disimpan ke server.",
      );
    return body.order;
  };

  useEffect(() => {
    if (!cart.length || !posSession) {
      if (!cart.length) localStorage.removeItem(ACTIVE_ORDER_SNAPSHOT_KEY);
      return;
    }
    const snapshot: ActiveOrderSnapshot = {
      version: 1,
      outletId: posSession.outlet.id,
      orderNumber,
      orderType,
      cart,
      selectedCartKey,
      discountPercent,
      couponValue,
      kitchenOrderId,
      kitchenCreatedAt,
      savedAt: new Date().toISOString(),
      diningTable: selectedTable,
    };
    localStorage.setItem(ACTIVE_ORDER_SNAPSHOT_KEY, JSON.stringify(snapshot));
    sessionStorage.setItem(ACTIVE_ORDER_KEY, orderNumber);
  }, [
    cart,
    couponValue,
    discountPercent,
    kitchenCreatedAt,
    kitchenOrderId,
    orderNumber,
    orderType,
    posSession,
    selectedCartKey,
    selectedTable,
  ]);

  const loadCatalog = async (silent = false) => {
    if (!posSession) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/pos/catalog?outlet=${encodeURIComponent(posSession.outlet.code)}&_=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
            Authorization: `Bearer ${posSession.token}`,
          },
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message || `Gagal mengambil produk (${response.status})`,
        );
      }
      const data = (await response.json()) as CatalogResponse;
      setOutlet(data.outlet);
      setCatalogError("");
      setAvailableAddOns(
        (data.add_ons || []).map((addOn) => ({
          ...addOn,
          price: Number(addOn.price),
        })),
      );
      setAvailableTables(data.tables || []);
      setProducts(
        data.products.map((product) => {
          const variants = (product.variants || []).map((variant) => ({
            ...variant,
            price: Number(variant.price),
          }));
          const defaultVariant =
            variants.find((variant) => variant.name === "M") || variants[0];
          return {
            id: product.id,
            sku: defaultVariant?.sku || product.sku,
            name: product.name,
            category: product.category,
            price: defaultVariant?.price || Number(product.price),
            normalPrice: defaultVariant?.price || Number(product.normal_price),
            imageUrl: product.image_url,
            productType: product.product_type,
            description: product.description,
            badge: product.promotion_name || undefined,
            variants,
            removableIngredients: product.removable_ingredients || [],
            variantId: defaultVariant?.id,
            size: defaultVariant?.name,
          };
        }),
      );
    } catch (error) {
      setCatalogError(
        error instanceof Error
          ? error.message
          : "Tidak dapat terhubung ke backoffice.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const releaseSelfServiceTable = async (order: SelfServiceOrder) => {
    setReleasingTableId(order.id);
    setSelfServiceMessage("");
    try {
      const response = await fetch(`${API_URL}/api/pos/self-service/orders/${order.id}/release-table`, { method: "POST", headers: authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Meja gagal dikosongkan.");
      setSelfServiceOrders((orders) => orders.map((item) => item.id === order.id ? { ...item, table_status: "available", table_session_status: "closed" } : item));
      setSelfServiceMessage(body.message);
      await loadCatalog(true);
    } catch (problem) {
      setSelfServiceMessage(problem instanceof Error ? problem.message : "Meja gagal dikosongkan.");
    } finally {
      setReleasingTableId("");
    }
  };

  useEffect(() => {
    void loadCatalog();
    const refreshCatalog = () => void loadCatalog(true);
    const timer = window.setInterval(refreshCatalog, 5000);
    window.addEventListener("focus", refreshCatalog);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshCatalog);
    };
  }, [posSession?.token]);

  const modeProducts = useMemo(
    () =>
      products.filter((product) => {
        if (saleMode === "bundle") return product.productType === "bundle";
        if (saleMode === "promo")
          return product.productType === "ala_carte" && Boolean(product.badge);
        return product.productType === "ala_carte";
      }),
    [products, saleMode],
  );

  const categories = useMemo(
    () => [
      "Semua",
      ...Array.from(new Set(modeProducts.map((product) => product.category))),
    ],
    [modeProducts],
  );

  const filteredProducts = useMemo(
    () =>
      modeProducts.filter((product) => {
        const matchesCategory =
          category === "Semua" || product.category === category;
        const matchesQuery = product.name
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [category, query, modeProducts],
  );

  const changeSaleMode = (mode: "ala_carte" | "bundle" | "promo") => {
    setSaleMode(mode);
    setCategory("Semua");
  };

  const addToCart = (product: Product) => {
    if (isPaid) return;
    setCart((items) => {
      const pricingLabel =
        saleMode === "promo"
          ? product.badge || "Promo"
          : saleMode === "bundle"
            ? "Bundle"
            : "À la carte";
      const cartKey = `${product.id}:${product.variantId || "default"}:${saleMode}`;
      const pricedProduct = {
        ...product,
        price: saleMode === "ala_carte" ? product.normalPrice : product.price,
      };
      const current = items.find((item) => item.cartKey === cartKey);
      setSelectedCartKey(cartKey);
      return current
        ? items.map((item) =>
            item.cartKey === cartKey
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...items, { ...pricedProduct, quantity: 1, cartKey, pricingLabel }];
    });
  };

  const updateQuantity = (cartKey: string, amount: number) =>
    !isPaid &&
    setCart((items) =>
      items
        .map((item) =>
          item.cartKey === cartKey
            ? { ...item, quantity: item.quantity + amount }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );

  const addOnTotal = (item: CartItem) =>
    (item.addons || []).reduce((sum, addOn) => sum + Number(addOn.price), 0);
  const unitTotal = (item: CartItem) =>
    discountedPrice(item.price, item.discounts) + addOnTotal(item);
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.price + addOnTotal(item)) * item.quantity,
    0,
  );
  const itemDiscountTotal = cart.reduce(
    (sum, item) => sum + itemDiscountValue(item) * item.quantity,
    0,
  );
  const orderLevelBase = Math.max(0, subtotal - itemDiscountTotal);
  const orderLevelDiscount = Math.min(
    orderLevelBase,
    Math.round((orderLevelBase * discountPercent) / 100) + couponValue,
  );
  const discount = itemDiscountTotal + orderLevelDiscount;
  const taxableSubtotal = subtotal - discount;
  const tax = Math.round(taxableSubtotal * 0.11);
  const total = taxableSubtotal + tax;
  const paymentTotal = payingPendingNumber && pendingServerTotal !== null ? pendingServerTotal : total;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItem =
    cart.find((item) => item.cartKey === selectedCartKey) || cart.at(-1);
  const draftDiscountedPrice = selectedItem
    ? discountedPrice(selectedItem.price, draftDiscounts)
    : 0;
  useEffect(() => {
    if (!cart.length) return;
    upsertKitchenOrder({
      id: kitchenOrderId,
      number: orderNumber,
      status: "draft",
      createdAt: kitchenCreatedAt,
      orderType,
      tableNumber: selectedTable?.table_number,
      items: cart.map((item) => ({
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        note: item.note,
        addons: [
          ...(item.removedIngredients || []).map((ingredient) =>
            ingredient.name.toUpperCase(),
          ),
          ...(item.addons || []).map(
            (addOn) => `${addOn.name} (+${formatRupiah(addOn.price)})`,
          ),
        ],
      })),
    });
  }, [
    cart,
    kitchenCreatedAt,
    kitchenOrderId,
    orderNumber,
    orderType,
    selectedTable,
  ]);
  const fixKitchenOrder = () => {
    if (!cart.length) return;
    upsertKitchenOrder({
      id: kitchenOrderId,
      number: payingPendingNumber || orderNumber,
      status: "fixed",
      createdAt: kitchenCreatedAt,
      fixedAt: new Date().toISOString(),
      orderType,
      tableNumber: selectedTable?.table_number,
      items: cart.map((item) => ({
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        note: item.note,
        addons: [
          ...(item.removedIngredients || []).map((ingredient) =>
            ingredient.name.toUpperCase(),
          ),
          ...(item.addons || []).map(
            (addOn) => `${addOn.name} (+${formatRupiah(addOn.price)})`,
          ),
        ],
      })),
    });
  };
  const resetOrder = () => {
    setCart([]);
    setSelectedCartKey("");
    setDiscountPercent(0);
    setCouponValue(0);
    setSelectedTable(null);
    setReceipt(null);
    setPaymentStep(null);
    setCashInput("");
    setPaymentError("");
    setPendingServerTotal(null);
    setKitchenOrderId(crypto.randomUUID());
    setKitchenCreatedAt(new Date().toISOString());
    setOrderNumber(nextOrderNumber());
  };
  const confirmResetOrder = () => {
    resetOrder();
    setConfirmDialog(null);
  };
  const savePendingOrders = (orders: Receipt[]) => {
    setPendingOrders(orders);
    localStorage.setItem("posphere.pendingPayments", JSON.stringify(orders));
  };
  const currentSnapshot = (status: Receipt["status"], method = "-") =>
    ({
      number: orderNumber,
      paidAt: new Date(),
      status,
      orderType,
      paymentMethod: method,
      items: cart.map((item) => ({ ...item })),
      subtotal,
      discount,
      tax,
      total,
    }) satisfies Receipt;
  const holdOrder = async () => {
    if (!cart.length) return;
    if (orderType === "Dine In" && !selectedTable) {
      setTableModal(true);
      return;
    }
    setSubmitting(true);
    setPaymentError("");
    try {
      const serverOrder = await submitOrderToServer();
      const draft = {
        ...currentSnapshot("BELUM LUNAS"),
        serverOrderId: serverOrder.id,
        number: serverOrder.order_number,
        total: Number(serverOrder.grand_total),
      };
      fixKitchenOrder();
      savePendingOrders([
        ...pendingOrders.filter(
          (item) => item.serverOrderId !== serverOrder.id,
        ),
        draft,
      ]);
      setReceipt(draft);
      setPaymentStep(null);
      window.setTimeout(() => {
        window.print();
        resetOrder();
      }, 80);
    } catch (problem) {
      setPaymentError(
        problem instanceof Error ? problem.message : "Pesanan gagal disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const resumePendingOrder = async (order: Receipt) => {
    setCart(order.items.map((item) => ({ ...item })));
    setOrderType(order.orderType);
    setOrderNumber(order.number);
    setDiscountPercent(0);
    const storedItemDiscount = order.items.reduce(
      (sum, item) => sum + itemDiscountValue(item) * item.quantity,
      0,
    );
    setCouponValue(Math.max(0, order.discount - storedItemDiscount));
    setPayingPendingNumber(order.number);
    setPendingModal(false);
    setReceipt(null);
    setSubmitting(true);
    setPaymentError("");
    try {
      if (!order.serverOrderId) throw new Error("ID pesanan server tidak tersedia pada nota pending ini.");
      const response = await fetch(`${API_URL}/api/pos/orders/${order.serverOrderId}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok || !body.order) throw new Error(body.message || "Tagihan pending tidak ditemukan.");
      if (body.order.payment_status === "paid") {
        savePendingOrders(pendingOrders.filter((item) => item.number !== order.number));
        throw new Error("Pesanan ini sudah lunas dan dihapus dari daftar pending.");
      }
      const remaining = Math.max(0, Number(body.order.grand_total) - Number(body.order.paid_total || 0));
      setPendingServerTotal(remaining);
      setCashInput(String(remaining));
      setPaymentStep("method");
    } catch (problem) {
      setPaymentError(problem instanceof Error ? problem.message : "Tagihan pending gagal dimuat.");
      setPaymentStep("method");
    } finally {
      setSubmitting(false);
    }
  };
  const changeSize = (variant: Product["variants"][number]) => {
    if (!selectedItem || isPaid) return;
    const oldSize = selectedItem.size || "-";
    const difference = variant.price - selectedItem.price;
    const newKey = `${selectedItem.id}:${variant.id}:${saleMode}`;
    setCart((items) =>
      items.map((item) =>
        item.cartKey === selectedItem.cartKey
          ? {
              ...item,
              cartKey: newKey,
              variantId: variant.id,
              size: variant.name,
              sku: variant.sku,
              price: variant.price,
              normalPrice: variant.price,
            }
          : item,
      ),
    );
    setSelectedCartKey(newKey);
    setSizeModal(false);
    setSizeNotice(
      `Ukuran ${selectedItem.name} berubah ${oldSize} → ${variant.name}${difference > 0 ? ` • Upsell +${formatRupiah(difference)}` : difference < 0 ? ` • Downgrade ${formatRupiah(Math.abs(difference))}` : ""}`,
    );
    window.setTimeout(() => setSizeNotice(""), 3500);
  };
  const openDiscountModal = () => {
    if (!selectedItem || isPaid) return;
    setDraftDiscounts(selectedItem.discounts || []);
    setDiscountType("percent");
    setDiscountValue("");
    setDiscountLabel("Diskon manual");
    setDiscountModal(true);
  };
  const appendDiscount = (
    type: ItemDiscount["type"],
    value: number,
    label: string,
  ) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const safeValue = type === "percent" ? Math.min(100, value) : value;
    setDraftDiscounts((rules) => [
      ...rules,
      { id: crypto.randomUUID(), type, value: safeValue, label },
    ]);
  };
  const addManualDiscount = () => {
    appendDiscount(
      discountType,
      Number(discountValue),
      discountLabel.trim() || "Diskon manual",
    );
    setDiscountValue("");
  };
  const saveItemDiscounts = () => {
    if (!selectedItem) return;
    setCart((items) =>
      items.map((item) =>
        item.cartKey === selectedItem.cartKey
          ? { ...item, discounts: draftDiscounts }
          : item,
      ),
    );
    setDiscountModal(false);
  };
  const askCoupon = () => {
    if (isPaid) return;
    const value = window.prompt("Nominal kupon (Rp)", String(couponValue));
    if (value !== null) setCouponValue(Math.max(0, Number(value) || 0));
  };
  const openItemOptions = () => {
    if (!selectedItem || isPaid) return;
    setItemNote(selectedItem.note || "");
    setItemAddons(selectedItem.addons || []);
    setItemRemovedIngredients(selectedItem.removedIngredients || []);
    setItemOptionModal(true);
  };
  const saveItemOptions = () => {
    if (!selectedItem) return;
    setCart((items) =>
      items.map((item) =>
        item.cartKey === selectedItem.cartKey
          ? {
              ...item,
              note: itemNote.trim(),
              addons: itemAddons,
              removedIngredients: itemRemovedIngredients,
            }
          : item,
      ),
    );
    setItemOptionModal(false);
  };
  const payOrder = () => {
    if (!cart.length || isPaid) return;
    if (orderType === "Dine In" && !selectedTable) {
      setTableModal(true);
      return;
    }
    setCashInput("");
    setPaymentError("");
    setPaymentStep("confirm");
  };
  const completePayment = async (referenceOverride?: string) => {
    if (paymentRequestLock.current || submitting) return;
    const cashReceived =
      paymentMethod === "Tunai" ? Number(cashInput || 0) : paymentTotal;
    if (paymentMethod === "Tunai" && cashReceived < paymentTotal) {
      setPaymentError(
        `Uang tunai kurang ${formatRupiah(paymentTotal - cashReceived)}.`,
      );
      return;
    }
    let reference: string | null = null;
    if (paymentMethod !== "Tunai") {
      reference = referenceOverride || null;
      if (paymentMethod !== "QRIS" && !reference) {
        reference =
          window
            .prompt(
              `Masukkan nomor referensi ${paymentMethod} dari perangkat pembayaran:`,
            )
            ?.trim() || null;
      }
      if (!reference) {
        setPaymentError(
          paymentMethod === "QRIS"
            ? "Pilih hasil pembayaran pada Simulator QRIS."
            : "Nomor referensi pembayaran non-tunai wajib diisi.",
        );
        return;
      }
    }
    paymentRequestLock.current = true;
    setSubmitting(true);
    setPaymentError("");
    try {
      const pending = payingPendingNumber
        ? pendingOrders.find((item) => item.number === payingPendingNumber)
        : undefined;
      const serverOrder = pending?.serverOrderId
        ? {
            id: pending.serverOrderId,
            order_number: pending.number,
            grand_total: pendingServerTotal ?? pending.total,
          }
        : await submitOrderToServer();
      const serverTotal = Number(serverOrder.grand_total);
      const method =
        paymentMethod === "Tunai"
          ? "cash"
          : paymentMethod === "QRIS"
            ? "qris"
            : paymentMethod === "Kartu Debit"
              ? "debit_card"
              : "e_wallet";
      const paymentResponse = await fetch(
        `${API_URL}/api/pos/orders/${serverOrder.id}/payments`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            idempotency_key: `payment:${serverOrder.id}:1`,
            method,
            amount: serverTotal,
            cash_received: paymentMethod === "Tunai" ? cashReceived : null,
            external_reference: reference,
          }),
        },
      );
      const paymentBody = (await paymentResponse.json().catch(() => ({}))) as {
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (!paymentResponse.ok)
        throw new Error(
          Object.values(paymentBody.errors || {})[0]?.[0] ||
            paymentBody.message ||
            "Pembayaran gagal dicatat.",
        );
      fixKitchenOrder();
      setReceipt({
        serverOrderId: serverOrder.id,
        number: serverOrder.order_number,
        paidAt: new Date(),
        status: "LUNAS",
        orderType,
        paymentMethod,
        items: cart.map((item) => ({ ...item })),
        subtotal,
        discount,
        tax,
        total: serverTotal,
        cashReceived,
        change: Math.max(0, cashReceived - serverTotal),
      });
      setPaymentStep(null);
      if (payingPendingNumber)
        savePendingOrders(
          pendingOrders.filter((order) => order.number !== payingPendingNumber),
        );
      window.setTimeout(() => {
        window.print();
        resetOrder();
        setPayingPendingNumber("");
      }, 80);
    } catch (problem) {
      setPaymentError(
        problem instanceof Error
          ? problem.message
          : "Pembayaran gagal dicatat. Jangan ulangi sebelum memeriksa status.",
      );
    } finally {
      paymentRequestLock.current = false;
      setSubmitting(false);
    }
  };
  const simulatePosQris = (result: "success" | "pending" | "failed") => {
    if (submitting) return;
    if (result === "pending") {
      setQrisSimulationStatus("pending");
      setPaymentError("Pembayaran QRIS masih pending. Pesanan belum dinyatakan lunas.");
      return;
    }
    if (result === "failed") {
      setQrisSimulationStatus("failed");
      setPaymentError("Pembayaran QRIS gagal. Silakan coba kembali.");
      return;
    }
    setQrisSimulationStatus(null);
    setPaymentError("");
    void completePayment(`MOCK-QRIS-POS-${Date.now()}`);
  };
  const pressCashKey = (key: string) => {
    setPaymentError("");
    if (key === "C") return setCashInput("");
    if (key === "⌫") return setCashInput((value) => value.slice(0, -1));
    setCashInput((value) => `${value}${key}`.replace(/^0+/, "").slice(0, 12));
  };
  const printReceipt = () => {
    if (!cart.length) {
      window.alert("Pesanan masih kosong dan belum dapat dicetak.");
      return;
    }
    if (!receipt || receipt.status !== "LUNAS") {
      setReceipt({
        number: orderNumber,
        paidAt: new Date(),
        status: "BELUM LUNAS",
        orderType,
        paymentMethod: "-",
        items: cart.map((item) => ({ ...item })),
        subtotal,
        discount,
        tax,
        total,
      });
      window.setTimeout(() => window.print(), 50);
      return;
    }
    window.print();
  };

  const logoutPos = async () => {
    if (posSession)
      await fetch(`${API_URL}/api/pos/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${posSession.token}`,
        },
      }).catch(() => undefined);
    localStorage.removeItem("posphere.posSession");
    setPosSession(null);
  };
  const requestLogout = () => {
    if (cart.length) {
      window.alert(
        "Masih ada pesanan aktif. Selesaikan atau simpan pesanan sebelum menutup shift.",
      );
      return;
    }
    if (!shift) {
      void logoutPos();
      return;
    }
    setClosingNote("");
    setShiftError("");
    setClosingShift(true);
  };
  const closeShiftAndLogout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shift) return;
    setSubmitting(true);
    setShiftError("");
    try {
      const response = await fetch(
        `${API_URL}/api/pos/shifts/${shift.id}/close`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ note: closingNote.trim() || null }),
        },
      );
      const body = (await response.json()) as {
        shift?: PosShift;
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (!response.ok || !body.shift)
        throw new Error(
          response.status === 429
            ? "Permintaan terlalu cepat. Tunggu beberapa detik lalu tekan Tutup Kasir satu kali."
            : Object.values(body.errors || {})[0]?.[0] ||
                body.message ||
                "Shift gagal ditutup.",
        );
      setReceipt(null);
      setShiftReport(body.shift);
      setClosingShift(false);
      setShift(null);
      window.setTimeout(() => {
        let completed = false;
        const finishLogout = async () => {
          if (completed) return;
          completed = true;
          window.removeEventListener("afterprint", finishLogout);
          await logoutPos();
          setShiftReport(null);
        };
        window.addEventListener("afterprint", finishLogout, { once: true });
        window.print();
      }, 150);
    } catch (problem) {
      setShiftError(
        problem instanceof Error ? problem.message : "Shift gagal ditutup.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  if (!posSession) return <FnbPosLogin onLogin={setPosSession} />;

  return (
    <main className="pos-shell">
      {sizeNotice && (
        <div className="size-change-notice">
          <b>✓ Ukuran diperbarui</b>
          <span>{sizeNotice}</span>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>
              POS<span>phere</span>
            </strong>
            <small>Point of Sale</small>
          </div>
        </div>
        <div className="store-info">
          <span className={`status-dot ${catalogError ? "offline" : ""}`} />
          <div>
            <strong>{outlet.name}</strong>
            <small>Store #{outlet.code}</small>
          </div>
        </div>
        <div className="operator">
          <div className="operator-avatar">
            {posSession.user.name
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <strong>{posSession.user.name}</strong>
            <small>
              {shift ? shift.register_name : "Shift belum dibuka"} •{" "}
              {posSession.outlet.name}
            </small>
          </div>
        </div>
      </header>

      {(unreadSelfServiceOrders.length > 0 || selfServiceOpen) && (
        <section className="self-service-alert">
          <button onClick={toggleSelfServiceOrders}>
            <span>SELF SERVICE</span>
            <strong>
              {selfServiceOpen ? `${selfServiceOrders.length} pesanan customer hari ini` : `${unreadSelfServiceOrders.length} pesanan baru`}
            </strong>
            <b>{selfServiceOpen ? "Tutup & Tandai Dibaca" : "Lihat Pesanan"}</b>
          </button>
          {selfServiceOpen && (
            <div>
              {selfServiceMessage && <p className="self-service-message">{selfServiceMessage}</p>}
              {selfServiceOrders.slice(0, 8).map((order) => (
                <article key={order.id}>
                  <span>
                    <b>Meja {order.table_number}</b>
                    <small>
                      #{order.order_number} •{" "}
                      {order.items
                        .map((item) => `${item.quantity}× ${item.name}`)
                        .join(", ")}
                    </small>
                  </span>
                  <strong className="self-service-total">
                    {formatRupiah(Number(order.grand_total))}
                    <small
                      className={order.payment_status === "paid" ? "paid" : ""}
                    >
                      {order.payment_status === "paid"
                        ? "SUDAH BAYAR • MASUK KITCHEN"
                        : "MENUNGGU PEMBAYARAN"}
                    </small>
                  </strong>
                  <button
                    className={`release-table-button ${order.table_status === "available" ? "released" : ""}`}
                    disabled={order.payment_status !== "paid" || order.table_status === "available" || releasingTableId === order.id}
                    onClick={() => void releaseSelfServiceTable(order)}
                  >
                    {order.table_status === "available" ? "Meja Sudah Kosong" : releasingTableId === order.id ? "Memproses..." : "Selesaikan & Kosongkan Meja"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="workspace">
        <section className="catalog-panel">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">TRANSAKSI BARU</p>
              <h1>Pilih Produk atau Layanan</h1>
              <p>Tambahkan item yang dibeli pelanggan.</p>
            </div>
            <button className="history-button">
              <Icon name="receipt" /> Riwayat Pesanan
            </button>
          </div>

          <div className="sale-mode-tabs">
            <button
              className={saleMode === "ala_carte" ? "active" : ""}
              onClick={() => changeSaleMode("ala_carte")}
            >
              <span className="mode-icon">A</span>
              <span>
                <strong>Produk / Layanan</strong>
                <small>Item satuan</small>
              </span>
            </button>
            <button
              className={saleMode === "bundle" ? "active" : ""}
              onClick={() => changeSaleMode("bundle")}
            >
              <span className="mode-icon">B</span>
              <span>
                <strong>Bundle / Paket</strong>
                <small>Paket pilihan</small>
              </span>
            </button>
            <button
              className={saleMode === "promo" ? "active" : ""}
              onClick={() => changeSaleMode("promo")}
            >
              <span className="mode-icon">%</span>
              <span>
                <strong>Promo</strong>
                <small>Penawaran aktif</small>
              </span>
            </button>
          </div>

          <div className="catalog-tools">
            <label className="search-box">
              <Icon name="search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari produk, layanan, atau SKU..."
              />
            </label>
            <div className="category-list">
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="result-meta">
            <strong>
              {category === "Semua"
                ? saleMode === "ala_carte"
                  ? "Semua Item"
                  : saleMode === "bundle"
                    ? "Paket Pilihan"
                    : "Promo Aktif"
                : category}
            </strong>
            <span>{filteredProducts.length} item tersedia</span>
          </div>
          {catalogError && (
            <div className="catalog-alert">
              <div>
                <strong>Katalog belum dapat dimuat</strong>
                <span>
                  {catalogError}. Pastikan server backoffice aktif di {API_URL}.
                </span>
              </div>
              <button onClick={() => void loadCatalog()}>Coba Lagi</button>
            </div>
          )}
          {loading && (
            <div className="product-grid">
              {Array.from({ length: 8 }, (_, index) => (
                <div className="product-skeleton" key={index}>
                  <div />
                  <span />
                  <small />
                </div>
              ))}
            </div>
          )}
          {!loading && !catalogError && (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button
                  className="product-card"
                  key={product.id}
                  onClick={() => addToCart(product)}
                >
                  <div className="product-card-head">
                    <span>{product.category}</span>
                    {product.size && <b>Default {product.size}</b>}
                    {saleMode === "promo" && product.badge && (
                      <b>{product.badge}</b>
                    )}
                  </div>
                  <div className="product-info">
                    <small>{product.sku}</small>
                    <strong>{product.name}</strong>
                    {product.description && <p>{product.description}</p>}
                    <span>
                      {formatRupiah(
                        saleMode === "ala_carte"
                          ? product.normalPrice
                          : product.price,
                      )}
                      {saleMode === "promo" &&
                        product.price < product.normalPrice && (
                          <del>{formatRupiah(product.normalPrice)}</del>
                        )}
                    </span>
                  </div>
                  <span className="add-product">+</span>
                </button>
              ))}
            </div>
          )}
          {!loading && !catalogError && filteredProducts.length === 0 && (
            <div className="empty-products">
              <Icon name="search" />
              <h3>Item tidak ditemukan</h3>
              <p>Coba gunakan kata kunci atau kategori lain.</p>
            </div>
          )}
        </section>

        <aside className="order-panel">
          <div className="order-head">
            <div>
              <p className="eyebrow">PESANAN AKTIF</p>
              <h2>Order #{orderNumber}</h2>
            </div>
            <button
              className="clear-button"
              onClick={() => setCart([])}
              title="Kosongkan pesanan"
            >
              <Icon name="trash" />
            </button>
          </div>
          <div className="order-type">
            {["Dine In", "Take Away", "Delivery"].map((type) => (
              <button
                key={type}
                className={orderType === type ? "active" : ""}
                onClick={() => setOrderType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          {orderType === "Dine In" && (
            <button
              className="table-selector"
              onClick={() => setTableModal(true)}
            >
              <span>
                <small>Nomor meja</small>
                <strong>
                  {selectedTable
                    ? `Meja ${selectedTable.table_number}`
                    : "Pilih meja kosong"}
                </strong>
              </span>
              <b>{selectedTable ? "Ubah" : "Pilih"}</b>
            </button>
          )}

          <div className="cart-title">
            <strong>Detail Pesanan</strong>
            <span>{itemCount} item</span>
          </div>
          <div className="cart-list">
            {cart.map((item) => (
              <article
                className={`cart-item ${selectedItem?.cartKey === item.cartKey ? "selected" : ""}`}
                key={item.cartKey}
                onClick={() => setSelectedCartKey(item.cartKey)}
              >
                <div className="cart-thumb">
                  {item.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="cart-copy">
                  <strong>{item.name}</strong>
                  <div className="cart-item-tags">
                    <small
                      className={`pricing-label ${item.pricingLabel === "À la carte" ? "" : "special"}`}
                    >
                      {item.pricingLabel}
                    </small>
                    {item.size && (
                      <small className="size-label">Ukuran {item.size}</small>
                    )}
                    {Boolean(item.discounts?.length) && (
                      <small className="discount-label">
                        {item.discounts?.length} diskon
                      </small>
                    )}
                  </div>
                  <small>
                    {item.sku} • {formatRupiah(item.price)}
                  </small>
                  {item.discounts?.map((rule) => (
                    <small className="item-discount-row" key={rule.id}>
                      − {rule.label}:{" "}
                      {rule.type === "percent"
                        ? `${rule.value}%`
                        : formatRupiah(rule.value)}
                    </small>
                  ))}
                  {Boolean(
                    item.removedIngredients?.length ||
                    item.addons?.length ||
                    item.note,
                  ) && (
                    <small className="item-kitchen-info">
                      {item.removedIngredients
                        ?.map((ingredient) => ingredient.name.toUpperCase())
                        .join(", ")}
                      {item.removedIngredients?.length && item.addons?.length
                        ? " • "
                        : ""}
                      {item.addons
                        ?.map(
                          (addOn) =>
                            `${addOn.name} (+${formatRupiah(addOn.price)})`,
                        )
                        .join(", ")}
                      {item.note && ` • ${item.note}`}
                    </small>
                  )}
                  <div className="quantity">
                    <button onClick={() => updateQuantity(item.cartKey, -1)}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartKey, 1)}>
                      +
                    </button>
                  </div>
                </div>
                <strong className="line-total">
                  {itemDiscountValue(item) > 0 && (
                    <del>
                      {formatRupiah(
                        (item.price + addOnTotal(item)) * item.quantity,
                      )}
                    </del>
                  )}
                  <span>{formatRupiah(unitTotal(item) * item.quantity)}</span>
                </strong>
              </article>
            ))}
            {!cart.length && (
              <div className="empty-cart">
                <div>
                  <Icon name="cart" />
                </div>
                <h3>Transaksi masih kosong</h3>
                <p>Pilih produk atau layanan untuk mulai bertransaksi.</p>
              </div>
            )}
          </div>

          <div className="order-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatRupiah(subtotal)}</strong>
            </div>
            {itemDiscountTotal > 0 && (
              <div>
                <span>Diskon item</span>
                <strong>-{formatRupiah(itemDiscountTotal)}</strong>
              </div>
            )}
            {orderLevelDiscount > 0 && (
              <div>
                <span>Diskon transaksi / kupon</span>
                <strong>-{formatRupiah(orderLevelDiscount)}</strong>
              </div>
            )}
            <div>
              <span>Pajak PB1 (11%)</span>
              <strong>{formatRupiah(tax)}</strong>
            </div>
            <div className="discount-row">
              <button>+ Tambah diskon atau promo</button>
            </div>
            <div className="grand-total">
              <span>Total Pembayaran</span>
              <strong>{formatRupiah(total)}</strong>
            </div>
            <button
              className="pay-button"
              disabled={!cart.length || isPaid}
              onClick={payOrder}
            >
              <span>{isPaid ? "Pembayaran Berhasil" : "Bayar Sekarang"}</span>
              <strong>{formatRupiah(total)} →</strong>
            </button>
            <button
              className="pay-later-button"
              disabled={!cart.length || isPaid || submitting}
              onClick={() => void holdOrder()}
            >
              <span>
                {submitting ? "Menyimpan..." : "Bayar Nanti & Cetak Nota"}
              </span>
              <small>Simpan ke pembayaran tertunda</small>
            </button>
            <div className="quick-actions">
              <button>Simpan Draft</button>
              <button>Catatan Pesanan</button>
            </div>
          </div>
        </aside>

        <aside className="action-rail">
          <button
            className="combo-action"
            onClick={() => changeSaleMode("bundle")}
          >
            Jadikan
            <br />
            <strong>Combo</strong>
          </button>
          <button
            disabled={!selectedItem?.variants.length}
            onClick={() => setSizeModal(true)}
          >
            Ubah Ukuran
          </button>
          <button
            disabled={!selectedItem}
            onClick={() =>
              selectedItem &&
              setCart((items) =>
                items.filter((item) => item.cartKey !== selectedItem.cartKey),
              )
            }
          >
            Hapus Item
          </button>
          <button onClick={askCoupon}>Kupon</button>
          <button disabled={!selectedItem} onClick={openDiscountModal}>
            Diskon Item
          </button>
          <button disabled={!selectedItem} onClick={openItemOptions}>
            Modifikasi
            <br />/ Add On
          </button>
          <button
            onClick={() =>
              window.alert(
                "Otorisasi manager diperlukan untuk tindakan khusus.",
              )
            }
          >
            Manager
          </button>
          <button className="table-setting-action" onClick={openTableManagement}>
            Setting
            <br />
            <strong>Meja</strong>
          </button>
          <button
            className="void-action"
            onClick={() =>
              setConfirmDialog({
                title: "Batalkan Pesanan?",
                message:
                  "Seluruh item pada pesanan aktif akan dihapus dan tidak dapat dikembalikan.",
                confirmLabel: "Ya, Batalkan",
                danger: true,
              })
            }
          >
            Batalkan
            <br />
            Pesanan
          </button>
        </aside>
      </section>
      {tableManagementOpen && (
        <div className="table-management-backdrop" onClick={() => setTableManagementOpen(false)}>
          <section className="table-management-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>SETTING MEJA</small>
                <h2>Kelola Status Meja</h2>
                <p>
                  {managedTableOutlet.name || posSession.outlet.name} · Store #{managedTableOutlet.code || posSession.outlet.code}
                </p>
              </div>
              <button className="table-management-close" onClick={() => setTableManagementOpen(false)} aria-label="Tutup">×</button>
            </header>
            <div className="table-management-summary">
              <span><b>{managedTables.filter((table) => table.status === "available").length}</b> Tersedia</span>
              <span><b>{managedTables.filter((table) => table.status === "occupied").length}</b> Digunakan</span>
              <button onClick={() => void loadManagedTables()} disabled={tableManagementLoading}>Perbarui Data</button>
            </div>
            {tableManagementMessage && <p className="table-management-message">{tableManagementMessage}</p>}
            <div className="table-management-grid">
              {tableManagementLoading && managedTables.length === 0 ? <div className="table-management-empty">Memuat data meja...</div> : managedTables.map((table) => {
                const canRelease = table.status === "occupied" && table.unpaid_order_count === 0;
                return (
                  <article key={table.id} className={`table-management-card ${table.status}`}>
                    <div className="table-management-number"><small>NO. MEJA</small><strong>{table.table_number}</strong></div>
                    <div className="table-management-info">
                      <span className={`table-status ${table.status}`}>{table.status === "available" ? "TERSEDIA" : table.status === "occupied" ? "DIGUNAKAN" : "NONAKTIF"}</span>
                      <b>{table.name || `Meja ${table.table_number}`}</b>
                      <small>Kapasitas {table.capacity} orang · {table.open_order_count} pesanan</small>
                    </div>
                    {table.status === "available" ? (
                      <button className="open-table-order" onClick={() => openOrderForTable(table)}>
                        Buka Pesanan
                      </button>
                    ) : (
                      <button disabled={!canRelease || releasingManagedTableId === table.id} onClick={() => void releaseManagedTable(table)}>
                        {releasingManagedTableId === table.id ? "Memproses..." : table.status === "inactive" ? "Meja Nonaktif" : table.unpaid_order_count > 0 ? `${table.unpaid_order_count} Tagihan Belum Lunas` : "Kosongkan Meja"}
                      </button>
                    )}
                  </article>
                );
              })}
              {!tableManagementLoading && managedTables.length === 0 && <div className="table-management-empty">Belum ada meja pada store ini.</div>}
            </div>
            <footer><button onClick={() => setTableManagementOpen(false)}>Selesai</button></footer>
          </section>
        </div>
      )}
      <footer className="service-bar">
        <div className="register-status">
          <strong>{shift?.register_code || "REGISTER"}</strong>
          <span>{shift ? "SHIFT AKTIF" : "BELUM BUKA"}</span>
        </div>
        <button
          onClick={() =>
            cart.length
              ? setConfirmDialog({
                  title: "Mulai Pesanan Baru?",
                  message:
                    "Pesanan aktif akan dikosongkan. Simpan sebagai Bayar Nanti jika pelanggan belum melakukan pembayaran.",
                  confirmLabel: "Mulai Pesanan Baru",
                })
              : resetOrder()
          }
        >
          Pesanan Baru
        </button>
        <button onClick={() => setPendingModal(true)}>
          Daftar Pending ({pendingOrders.length})
        </button>
        <button onClick={printReceipt}>Print Receipt</button>
        <div className="service-modes">
          {["Dine In", "Take Away", "Delivery"].map((type) => (
            <button
              key={type}
              className={orderType === type ? "active" : ""}
              onClick={() => setOrderType(type)}
            >
              {type}
            </button>
          ))}
        </div>
        <time>
          {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
            new Date(),
          )}
        </time>
        <button className="shift-logout-footer" onClick={requestLogout}>
          <span>Tutup Kasir</span>
          <b>Logout</b>
        </button>
      </footer>
      {(!shift || shiftLoading) && (
        <div className="shift-backdrop">
          <form className="shift-dialog" onSubmit={openShift}>
            <div className="shift-icon">Rp</div>
            <small>OPEN KASIR</small>
            <h2>{shiftLoading ? "Memeriksa shift..." : "Buka Shift Kasir"}</h2>
            <p>
              Kasir wajib membuka register dan mencatat modal awal sebelum
              menerima transaksi.
            </p>
            {!shiftLoading && (
              <>
                <label>
                  Register
                  <select
                    value={selectedRegister}
                    onChange={(event) =>
                      setSelectedRegister(event.target.value)
                    }
                    required
                  >
                    <option value="">Pilih register</option>
                    {registers.map((register) => (
                      <option key={register.id} value={register.id}>
                        {register.code} — {register.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Modal awal kas
                  <input
                    type="text"
                    inputMode="none"
                    value={openingCash}
                    readOnly
                    placeholder="Sentuh keypad angka"
                    required
                  />
                </label>
                <div className="shift-amount-preview">
                  {formatRupiah(Number(openingCash || 0))}
                </div>
                <div className="shift-keypad">
                  {[
                    "7",
                    "8",
                    "9",
                    "4",
                    "5",
                    "6",
                    "1",
                    "2",
                    "3",
                    "C",
                    "0",
                    "⌫",
                  ].map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={key === "C" || key === "⌫" ? "utility" : ""}
                      onClick={() => pressShiftAmount(key, setOpeningCash)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="shift-presets">
                  {[100000, 200000, 300000, 500000].map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      onClick={() => setOpeningCash(String(amount))}
                    >
                      {formatRupiah(amount)}
                    </button>
                  ))}
                </div>
                {shiftError && <div className="shift-error">{shiftError}</div>}
                <button disabled={submitting || !selectedRegister}>
                  {submitting
                    ? "Membuka shift..."
                    : "Buka Kasir & Mulai Jualan"}
                </button>
                <button
                  type="button"
                  className="shift-logout"
                  onClick={() => void logoutPos()}
                >
                  Kembali ke Login
                </button>
              </>
            )}
          </form>
        </div>
      )}
      {closingShift && shift && (
        <div className="shift-backdrop">
          <form className="shift-dialog close" onSubmit={closeShiftAndLogout}>
            <div className="shift-icon">Z</div>
            <small>TUTUP SHIFT & LOGOUT</small>
            <h2>Cetak Laporan Penjualan</h2>
            <p>
              Seluruh transaksi dan total setiap jenis pembayaran akan dihitung
              dari server lalu dicetak otomatis.
            </p>
            <div className="shift-current">
              <span>Shift</span>
              <b>{shift.shift_number}</b>
              <span>Modal awal</span>
              <b>{formatRupiah(Number(shift.opening_cash))}</b>
            </div>
            <label>
              Catatan penutupan
              <textarea
                value={closingNote}
                onChange={(event) => setClosingNote(event.target.value)}
                placeholder="Opsional, contoh: operasional shift berjalan normal"
              />
            </label>
            {shiftError && <div className="shift-error">{shiftError}</div>}
            <button disabled={submitting}>
              {submitting
                ? "Menghitung transaksi..."
                : "Tutup Kasir, Cetak Semua & Logout"}
            </button>
            <button
              type="button"
              className="shift-logout"
              disabled={submitting}
              onClick={() => setClosingShift(false)}
            >
              Batal
            </button>
          </form>
        </div>
      )}
      {tableModal && (
        <div
          className="table-picker-backdrop"
          onClick={() => setTableModal(false)}
        >
          <section
            className="table-picker-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>MEJA TERSEDIA</small>
                <h2>Pilih Nomor Meja</h2>
                <p>
                  Hanya meja kosong dari Data Meja Backoffice yang dapat
                  dipilih.
                </p>
              </div>
              <button onClick={() => setTableModal(false)}>×</button>
            </header>
            <div className="table-picker-grid">
              {availableTables.map((table) => (
                <button
                  key={table.id}
                  className={selectedTable?.id === table.id ? "active" : ""}
                  onClick={() => {
                    setSelectedTable(table);
                    setTableModal(false);
                  }}
                >
                  <span>MEJA</span>
                  <strong>{table.table_number}</strong>
                  <small>
                    {table.name} • {table.capacity} orang
                  </small>
                  <b>
                    {selectedTable?.id === table.id ? "Terpilih" : "Kosong"}
                  </b>
                </button>
              ))}
            </div>
            {!availableTables.length && (
              <div className="table-picker-empty">
                <b>Semua meja sedang terisi</b>
                <span>
                  Perbarui status meja melalui Data Meja Backoffice atau tunggu
                  transaksi selesai.
                </span>
                <button onClick={() => void loadCatalog()}>Muat Ulang</button>
              </div>
            )}
            <footer>
              <button onClick={() => setTableModal(false)}>Batal</button>
              <button onClick={() => void loadCatalog(true)}>
                Perbarui Daftar Meja
              </button>
            </footer>
          </section>
        </div>
      )}
      {discountModal && selectedItem && (
        <div className="discount-backdrop">
          <section className="discount-panel">
            <header>
              <div>
                <small>DISKON PER ITEM</small>
                <h2>Atur Diskon Produk</h2>
                <p>
                  {selectedItem.name} • Harga awal{" "}
                  {formatRupiah(selectedItem.price)}
                </p>
              </div>
              <button onClick={() => setDiscountModal(false)}>×</button>
            </header>
            <div className="discount-layout">
              <main>
                <section className="discount-defaults">
                  <strong>Diskon default</strong>
                  <p>
                    Pilih satu atau beberapa diskon. Diskon dihitung berurutan
                    dari harga terakhir.
                  </p>
                  <div>
                    {[5, 10, 15, 20, 25, 50].map((value) => (
                      <button
                        key={value}
                        onClick={() =>
                          appendDiscount("percent", value, `Diskon ${value}%`)
                        }
                      >
                        <b>{value}%</b>
                        <span>Tambahkan</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="discount-manual">
                  <strong>Diskon manual</strong>
                  <div className="discount-form">
                    <label>
                      Nama diskon
                      <input
                        value={discountLabel}
                        onChange={(event) =>
                          setDiscountLabel(event.target.value)
                        }
                        placeholder="Contoh: Diskon member"
                      />
                    </label>
                    <label>
                      Jenis
                      <select
                        value={discountType}
                        onChange={(event) =>
                          setDiscountType(
                            event.target.value as ItemDiscount["type"],
                          )
                        }
                      >
                        <option value="percent">Persen (%)</option>
                        <option value="amount">Nominal (Rp)</option>
                      </select>
                    </label>
                    <label>
                      Nilai
                      <input
                        type="number"
                        min="0"
                        max={discountType === "percent" ? 100 : undefined}
                        value={discountValue}
                        onChange={(event) =>
                          setDiscountValue(event.target.value)
                        }
                        placeholder={
                          discountType === "percent" ? "10" : "10000"
                        }
                      />
                    </label>
                    <button
                      disabled={!Number(discountValue)}
                      onClick={addManualDiscount}
                    >
                      + Tambahkan Diskon
                    </button>
                  </div>
                </section>
              </main>
              <aside>
                <small>RINGKASAN HARGA</small>
                <div className="discount-price">
                  <span>Harga awal</span>
                  <b>{formatRupiah(selectedItem.price)}</b>
                </div>
                <div className="discount-stack">
                  {draftDiscounts.map((rule, index) => (
                    <article key={rule.id}>
                      <span>
                        <i>{index + 1}</i>
                        <b>{rule.label}</b>
                        <small>
                          {rule.type === "percent"
                            ? `${rule.value}%`
                            : formatRupiah(rule.value)}
                        </small>
                      </span>
                      <button
                        onClick={() =>
                          setDraftDiscounts((rules) =>
                            rules.filter((item) => item.id !== rule.id),
                          )
                        }
                      >
                        Hapus
                      </button>
                    </article>
                  ))}
                  {!draftDiscounts.length && (
                    <p>Belum ada diskon pada item ini.</p>
                  )}
                </div>
                <div className="discount-final">
                  <span>Harga akhir per item</span>
                  <strong>{formatRupiah(draftDiscountedPrice)}</strong>
                  <small>
                    Hemat{" "}
                    {formatRupiah(selectedItem.price - draftDiscountedPrice)}
                  </small>
                </div>
              </aside>
            </div>
            <footer>
              <button onClick={() => setDiscountModal(false)}>Batal</button>
              <button
                className="clear-discounts"
                disabled={!draftDiscounts.length}
                onClick={() => setDraftDiscounts([])}
              >
                Hapus Semua
              </button>
              <button className="save-discounts" onClick={saveItemDiscounts}>
                Terapkan {draftDiscounts.length} Diskon
              </button>
            </footer>
          </section>
        </div>
      )}
      {itemOptionModal && selectedItem && (
        <div className="payment-backdrop">
          <section className="item-option-panel">
            <header>
              <div>
                <small>DETAIL ITEM</small>
                <h2>Modifikasi Ingredient / Add On</h2>
                <p>
                  {selectedItem.name} • Ukuran {selectedItem.size}
                </p>
              </div>
              <button onClick={() => setItemOptionModal(false)}>×</button>
            </header>
            <div className="ingredient-options">
              <strong>
                Kurangi Ingredient <small>Tanpa biaya</small>
              </strong>
              <div>
                {selectedItem.removableIngredients.map((ingredient) => {
                  const selected = itemRemovedIngredients.some(
                    (item) => item.id === ingredient.id,
                  );
                  return (
                    <button
                      key={ingredient.id}
                      className={selected ? "active" : ""}
                      onClick={() =>
                        setItemRemovedIngredients((items) =>
                          selected
                            ? items.filter((item) => item.id !== ingredient.id)
                            : [...items, ingredient],
                        )
                      }
                    >
                      {selected ? "✓ " : ""}
                      {ingredient.name}
                    </button>
                  );
                })}
              </div>
              {!selectedItem.removableIngredients.length && (
                <p className="addon-empty">
                  Modifier belum tersedia. Atur melalui Master Data → Modifier
                  Ingredient.
                </p>
              )}
            </div>
            <div className="addon-options">
              <strong>
                Pilih Add On <small>Dengan harga tambahan</small>
              </strong>
              <div>
                {availableAddOns.map((addOn) => {
                  const selected = itemAddons.some(
                    (item) => item.id === addOn.id,
                  );
                  return (
                    <button
                      key={addOn.id}
                      className={selected ? "active" : ""}
                      onClick={() =>
                        setItemAddons((items) =>
                          selected
                            ? items.filter((item) => item.id !== addOn.id)
                            : [...items, addOn],
                        )
                      }
                    >
                      <span>
                        {selected ? "✓ " : "+ "}
                        {addOn.name}
                      </span>
                      <small>{formatRupiah(addOn.price)}</small>
                    </button>
                  );
                })}
              </div>
              {!availableAddOns.length && (
                <p className="addon-empty">
                  Belum ada add-on aktif. Tambahkan melalui Master Data
                  Backoffice.
                </p>
              )}
              <div className="addon-selection-total">
                <span>Total add-on per item</span>
                <strong>
                  {formatRupiah(
                    itemAddOns.reduce((sum, addOn) => sum + addOn.price, 0),
                  )}
                </strong>
              </div>
            </div>
            <label>
              Catatan untuk Kitchen
              <textarea
                value={itemNote}
                onChange={(event) => setItemNote(event.target.value)}
                placeholder="Contoh: saus dipisah, burger dipotong dua..."
              />
            </label>
            <footer>
              <button onClick={() => setItemOptionModal(false)}>Batal</button>
              <button onClick={saveItemOptions}>Simpan ke Pesanan</button>
            </footer>
          </section>
        </div>
      )}
      {confirmDialog && (
        <div className="touch-confirm-backdrop">
          <section
            className={`touch-confirm-dialog ${confirmDialog.danger ? "danger" : ""}`}
          >
            <div className="touch-confirm-icon">!</div>
            <h2>{confirmDialog.title}</h2>
            <p>{confirmDialog.message}</p>
            <div>
              <button onClick={() => setConfirmDialog(null)}>Kembali</button>
              <button onClick={confirmResetOrder}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingModal && (
        <div className="payment-backdrop">
          <section className="pending-orders-panel">
            <header>
              <div>
                <small>PEMBAYARAN TERTUNDA</small>
                <h2>Nota Belum Lunas</h2>
              </div>
              <button onClick={() => setPendingModal(false)}>×</button>
            </header>
            {pendingOrders.length ? (
              <div className="pending-order-list">
                {pendingOrders.map((order) => (
                  <article key={order.number}>
                    <div>
                      <b>#{order.number}</b>
                      <span>
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(order.paidAt)}
                      </span>
                      <small>
                        {order.items.length} baris item • {order.orderType}
                      </small>
                    </div>
                    <strong>{formatRupiah(order.total)}</strong>
                    <button onClick={() => resumePendingOrder(order)}>
                      Lanjut Bayar
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="pending-empty">
                <b>Tidak ada pembayaran tertunda</b>
                <span>Nota yang memilih Bayar Nanti akan muncul di sini.</span>
              </div>
            )}
          </section>
        </div>
      )}
      {paymentStep && (
        <div className="payment-backdrop">
          {paymentStep === "confirm" ? (
            <section className="payment-confirm-panel">
              <header>
                <small>KONFIRMASI PESANAN</small>
                <h2>Lanjut ke pembayaran?</h2>
                <p>
                  Periksa kembali pesanan sebelum memilih metode pembayaran.
                </p>
              </header>
              <div className="payment-confirm-total">
                <span>Total Pembayaran</span>
                <strong>{formatRupiah(total)}</strong>
                <small>
                  {itemCount} item • {orderType}
                </small>
              </div>
              <div className="touch-dialog-actions three">
                <button
                  className="secondary"
                  disabled={submitting}
                  onClick={() => setPaymentStep(null)}
                >
                  Batal
                </button>
                <button
                  className="pending"
                  disabled={submitting}
                  onClick={() => void holdOrder()}
                >
                  {submitting ? "Menyimpan..." : "Bayar Nanti & Cetak"}
                </button>
                <button
                  className="primary"
                  disabled={submitting}
                  onClick={() => setPaymentStep("method")}
                >
                  Bayar Sekarang
                </button>
              </div>
            </section>
          ) : (
            <section className="payment-page">
              <header>
                <div>
                  <small>PEMBAYARAN</small>
                  <h2>Pilih Metode Pembayaran</h2>
                </div>
                <button onClick={() => setPaymentStep(null)}>×</button>
              </header>
              <div className="payment-layout">
                <main className="payment-main">
                  <div className="payment-methods">
                    {["Tunai", "QRIS", "Kartu Debit", "E-Wallet"].map(
                      (method) => (
                        <button
                          key={method}
                          className={paymentMethod === method ? "active" : ""}
                          onClick={() => {
                            setPaymentMethod(method);
                            setPaymentError("");
                            setQrisSimulationStatus(null);
                          }}
                        >
                          <b>
                            {method === "Tunai"
                              ? "Rp"
                              : method === "QRIS"
                                ? "QR"
                                : method === "Kartu Debit"
                                  ? "CARD"
                                  : "EW"}
                          </b>
                          <span>{method}</span>
                        </button>
                      ),
                    )}
                  </div>
                  {paymentMethod === "Tunai" ? (
                    <div className="cash-payment">
                      <section>
                        <small>UANG DITERIMA</small>
                        <strong>{formatRupiah(Number(cashInput || 0))}</strong>
                        <div className="cash-presets">
                          <button onClick={() => setCashInput(String(paymentTotal))}>
                            Uang Pas
                          </button>
                          {[10000, 20000, 50000, 100000].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => setCashInput(String(amount))}
                            >
                              {formatRupiah(amount)}
                            </button>
                          ))}
                        </div>
                        <div className="change-preview">
                          <span>Kembalian</span>
                          <b>
                            {formatRupiah(
                              Math.max(0, Number(cashInput || 0) - paymentTotal),
                            )}
                          </b>
                        </div>
                        {paymentError && <p>{paymentError}</p>}
                      </section>
                      <div className="cash-keypad">
                        {[
                          "7",
                          "8",
                          "9",
                          "4",
                          "5",
                          "6",
                          "1",
                          "2",
                          "3",
                          "C",
                          "0",
                          "⌫",
                        ].map((key) => (
                          <button
                            key={key}
                            className={
                              key === "C" || key === "⌫" ? "utility" : ""
                            }
                            onClick={() => pressCashKey(key)}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : paymentMethod === "QRIS" ? (
                    <div className="pos-qris-simulator">
                      <div className="pos-qris-heading">
                        <span>MOCK MIDTRANS</span>
                        <h3>Simulasikan pembayaran QRIS</h3>
                        <p>Mode pengujian lokal · tidak menggunakan uang sungguhan</p>
                      </div>
                      <div className="pos-qris-code" aria-label="Simulasi QRIS">
                        <div className="mock-qr-pattern" />
                        <strong>{formatRupiah(paymentTotal)}</strong>
                        <small>QRIS · #{payingPendingNumber || orderNumber}</small>
                      </div>
                      <div className="pos-qris-results">
                        <button className="success" disabled={submitting} onClick={() => simulatePosQris("success")}>
                          <b>✓ Pembayaran Berhasil</b><small>Catat lunas dan proses pesanan</small>
                        </button>
                        <button className={qrisSimulationStatus === "pending" ? "pending active" : "pending"} disabled={submitting} onClick={() => simulatePosQris("pending")}>
                          <b>◷ Pembayaran Pending</b><small>Belum mencatat pembayaran</small>
                        </button>
                        <button className={qrisSimulationStatus === "failed" ? "failed active" : "failed"} disabled={submitting} onClick={() => simulatePosQris("failed")}>
                          <b>× Pembayaran Gagal</b><small>Dapat dicoba kembali</small>
                        </button>
                      </div>
                      {paymentError && <p className="pos-qris-error">{paymentError}</p>}
                    </div>
                  ) : (
                    <div className="noncash-guide">
                      <b>{paymentMethod}</b>
                      <h3>Siapkan alat pembayaran</h3>
                      <p>
                        Lanjutkan transaksi pada perangkat pembayaran, lalu
                        tekan konfirmasi.
                      </p>
                    </div>
                  )}
                </main>
                <aside>
                  <small>TOTAL TAGIHAN</small>
                  <strong>{formatRupiah(paymentTotal)}</strong>
                  <div>
                    <span>Metode</span>
                    <b>{paymentMethod}</b>
                  </div>
                  <div>
                    <span>Status</span>
                    <b>Menunggu pembayaran</b>
                  </div>
                  <button
                    disabled={
                      submitting ||
                      paymentMethod === "QRIS" ||
                      (paymentMethod === "Tunai" &&
                        Number(cashInput || 0) < paymentTotal)
                    }
                    onClick={() => void completePayment()}
                  >
                    {submitting
                      ? "Memproses Pembayaran..."
                      : paymentMethod === "QRIS"
                        ? "Gunakan Simulator QRIS"
                      : `Bayar ${formatRupiah(paymentTotal)}`}
                  </button>
                  <button
                    className="back"
                    onClick={() => setPaymentStep("confirm")}
                  >
                    Kembali
                  </button>
                </aside>
              </div>
            </section>
          )}
        </div>
      )}
      {sizeModal && selectedItem && (
        <div className="pos-modal-backdrop" onClick={() => setSizeModal(false)}>
          <section
            className="size-picker"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>UPSELLING / DOWNGRADE</small>
                <h2>Ubah Ukuran {selectedItem.name}</h2>
              </div>
              <button onClick={() => setSizeModal(false)}>×</button>
            </header>
            <p>
              Ukuran aktif <strong>{selectedItem.size || "-"}</strong>. Pilih
              ukuran pengganti:
            </p>
            <div>
              {selectedItem.variants.map((variant) => (
                <button
                  key={variant.id}
                  className={
                    selectedItem.variantId === variant.id ? "active" : ""
                  }
                  onClick={() => changeSize(variant)}
                >
                  <b>{variant.name}</b>
                  <span>{formatRupiah(variant.price)}</span>
                  <small>
                    {variant.name === selectedItem.size
                      ? "Ukuran saat ini"
                      : variant.price > selectedItem.price
                        ? `Upsell +${formatRupiah(variant.price - selectedItem.price)}`
                        : `Downgrade ${formatRupiah(selectedItem.price - variant.price)}`}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {receipt && (
        <section className="print-receipt" aria-hidden="true">
          <header>
            <div className="receipt-logo">
              POS<span>phere</span>
            </div>
            <p>{outlet.name.toUpperCase()}</p>
            <small>STORE #{outlet.code}</small>
            <b>*** CUSTOMER COPY ***</b>
          </header>
          <div className="receipt-order">
            <small>ORDER NUMBER</small>
            <strong>{receipt.number}</strong>
            <span>{receipt.orderType.toUpperCase()}</span>
          </div>
          <div className="receipt-meta">
            <span>Tanggal</span>
            <strong>
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(receipt.paidAt)}
            </strong>
            <span>Register</span>
            <strong>{shift?.register_code || "-"}</strong>
            <span>Kasir</span>
            <strong>{posSession.user.name}</strong>
            <span>Bayar</span>
            <strong>{receipt.paymentMethod.toUpperCase()}</strong>
          </div>
          <div className="receipt-columns">
            <b>QTY ITEM</b>
            <b>JUMLAH</b>
          </div>
          <div className="receipt-items">
            {receipt.items.map((item) => (
              <div key={item.cartKey}>
                <span>
                  {item.quantity}× {item.name}
                  {item.size ? ` (${item.size})` : ""}
                  <small>
                    {formatRupiah(item.price)}
                    {item.removedIngredients?.map((ingredient) => (
                      <i key={ingredient.id}>{ingredient.name.toUpperCase()}</i>
                    ))}
                    {item.addons?.map((addOn) => (
                      <i key={addOn.id}>
                        + {addOn.name} {formatRupiah(addOn.price)}
                      </i>
                    ))}
                  </small>
                </span>
                <strong>{formatRupiah(unitTotal(item) * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="receipt-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatRupiah(receipt.subtotal)}</strong>
            </div>
            {receipt.discount > 0 && (
              <div>
                <span>Diskon</span>
                <strong>-{formatRupiah(receipt.discount)}</strong>
              </div>
            )}
            <div>
              <span>PB1 (11%)</span>
              <strong>{formatRupiah(receipt.tax)}</strong>
            </div>
            <div className="receipt-grand">
              <span>TOTAL</span>
              <strong>{formatRupiah(receipt.total)}</strong>
            </div>
            {receipt.status === "LUNAS" &&
              receipt.paymentMethod === "Tunai" && (
                <>
                  <div>
                    <span>Uang Tunai</span>
                    <strong>{formatRupiah(receipt.cashReceived || 0)}</strong>
                  </div>
                  <div>
                    <span>Kembalian</span>
                    <strong>{formatRupiah(receipt.change || 0)}</strong>
                  </div>
                </>
              )}
          </div>
          <div
            className={`receipt-paid ${receipt.status === "LUNAS" ? "" : "unpaid"}`}
          >
            {receipt.status}
          </div>
          <footer>
            <strong>
              {receipt.status === "LUNAS" ? "TERIMA KASIH" : "NOTA SEMENTARA"}
            </strong>
            <span>
              {receipt.status === "LUNAS"
                ? "Terima kasih atas kunjungan Anda"
                : "BUKAN BUKTI PEMBAYARAN"}
            </span>
            <i>================================</i>
            <small>www.posphere.id</small>
          </footer>
        </section>
      )}
      {shiftReport && (
        <section className="print-shift-report" aria-hidden="true">
          <header>
            <div className="receipt-logo">
              POS<span>phere</span>
            </div>
            <b>*** LAPORAN TUTUP SHIFT / Z REPORT ***</b>
            <p>{posSession.outlet.name.toUpperCase()}</p>
          </header>
          <div className="shift-print-meta">
            <span>Shift</span>
            <b>{shiftReport.shift_number}</b>
            <span>Register</span>
            <b>{shiftReport.register_code}</b>
            <span>Kasir</span>
            <b>{shiftReport.cashier_name || posSession.user.name}</b>
            <span>Dibuka</span>
            <b>{new Date(shiftReport.opened_at).toLocaleString("id-ID")}</b>
            <span>Ditutup</span>
            <b>
              {shiftReport.closed_at
                ? new Date(shiftReport.closed_at).toLocaleString("id-ID")
                : "-"}
            </b>
          </div>
          <h3>RINGKASAN PENJUALAN</h3>
          <div className="shift-print-values">
            <span>Jumlah transaksi</span>
            <b>{shiftReport.total_orders || 0}</b>
            <span>Penjualan kotor</span>
            <b>{formatRupiah(shiftReport.gross_sales || 0)}</b>
            <span>Diskon</span>
            <b>-{formatRupiah(shiftReport.discount_total || 0)}</b>
            <span>Pajak</span>
            <b>{formatRupiah(shiftReport.tax_total || 0)}</b>
            <span>Total pembayaran</span>
            <b>{formatRupiah(shiftReport.paid_total || 0)}</b>
          </div>
          <h3>PEMBAYARAN PER JENIS</h3>
          <div className="shift-payment-print">
            {shiftReport.payment_summary?.map((payment) => (
              <div key={payment.method}>
                <span>
                  {payment.method.replace(/_/g, " ").toUpperCase()} (
                  {payment.transaction_count} trx)
                </span>
                <b>{formatRupiah(payment.total)}</b>
              </div>
            ))}
            {!shiftReport.payment_summary?.length && (
              <div>
                <span>Belum ada pembayaran</span>
                <b>Rp 0</b>
              </div>
            )}
          </div>
          <h3>JENIS PESANAN</h3>
          <div className="shift-payment-print">
            {shiftReport.order_type_summary?.map((type) => (
              <div key={type.order_type}>
                <span>
                  {type.order_type.replace(/_/g, " ").toUpperCase()} (
                  {type.transaction_count} penjualan)
                </span>
                <b>{formatRupiah(type.total)}</b>
              </div>
            ))}
            {!shiftReport.order_type_summary?.length && (
              <div>
                <span>Belum ada penjualan</span>
                <b>Rp 0</b>
              </div>
            )}
          </div>
          <h3>RINGKASAN CASH</h3>
          <div className="shift-print-values">
            <span>Modal awal</span>
            <b>{formatRupiah(Number(shiftReport.opening_cash))}</b>
            <span>Total pembayaran cash</span>
            <b>
              {formatRupiah(
                shiftReport.payment_summary?.find(
                  (item) => item.method === "cash",
                )?.total || 0,
              )}
            </b>
            <span>Total kas akhir sistem</span>
            <b>{formatRupiah(Number(shiftReport.expected_cash || 0))}</b>
          </div>
          <footer>
            Dicetak otomatis saat tutup shift
            <br />
            Dokumen kontrol internal — simpan bersama setoran kas
          </footer>
        </section>
      )}
    </main>
  );
}

export default App;
