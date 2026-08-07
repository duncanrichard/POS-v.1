import React, { useEffect, useState } from "react";
import Select from "react-select";
import {
    LayoutDashboard,
    ShoppingBag,
    ChefHat,
    Package,
    Truck,
    Users,
    BadgePercent,
    BarChart3,
    Settings,
    Bell,
    Search,
    ChevronDown,
    TrendingUp,
    MoreHorizontal,
    ArrowUpRight,
    Clock3,
    CircleDollarSign,
    AlertTriangle,
    Menu,
    X,
    Plus,
    Download,
    SlidersHorizontal,
    CheckCircle2,
    ClipboardList,
    Warehouse,
    Boxes,
    ReceiptText,
    UserRound,
    ShieldCheck,
    Building2,
    Store,
    KeyRound,
    MapPin,
    LocateFixed,
    Pencil,
    Trash2,
} from "lucide-react";
import { csrf, ListControls, rupiah, useListView } from "../../shared/ui";

export const modulePageDefinitions = {
    "/sales": {
        label: "Penjualan",
        icon: ShoppingBag,
        description: "Kelola seluruh transaksi dan status pembayaran.",
        action: "Buat pesanan",
        stats: [
            ["Pesanan hari ini", "286"],
            ["Open bill", "18"],
            ["Belum lunas", "7"],
            ["Refund", "3"],
        ],
        columns: [
            "Nomor order",
            "Pelanggan / Meja",
            "Channel",
            "Total",
            "Pembayaran",
            "Status",
        ],
        rows: [
            [
                "INV-000128",
                "Meja 12",
                "Dine in",
                "Rp 428.000",
                "Lunas",
                "Disajikan",
            ],
            [
                "INV-000127",
                "Ayu Lestari",
                "Takeaway",
                "Rp 186.000",
                "Open bill",
                "Diproses",
            ],
            [
                "INV-000126",
                "Meja 04",
                "Dine in",
                "Rp 312.500",
                "Partial",
                "Siap",
            ],
        ],
    },
    "/kitchen": {
        label: "Kitchen",
        icon: ChefHat,
        description: "Pantau tiket dan SLA produksi setiap station.",
        action: "Buka tampilan KDS",
        stats: [
            ["Tiket aktif", "18"],
            ["Antrian baru", "6"],
            ["Sedang diproses", "8"],
            ["Siap disajikan", "4"],
        ],
        columns: [
            "Nomor tiket",
            "Order",
            "Station",
            "Masuk",
            "Payment",
            "Produksi",
        ],
        rows: [
            [
                "K-000245",
                "INV-000128",
                "Main Kitchen",
                "08:41",
                "Open bill",
                "Diproses",
            ],
            ["K-000244", "INV-000127", "Bar", "08:38", "Lunas", "Siap"],
            ["K-000243", "INV-000126", "Grill", "08:35", "Partial", "Diterima"],
        ],
    },
    "/inventory": {
        label: "Inventory",
        icon: Package,
        description: "Kontrol saldo, pergerakan, batch, dan expiry bahan baku.",
        action: "Catat pergerakan",
        stats: [
            ["Total SKU", "428"],
            ["Stok kritis", "12"],
            ["Akan kedaluwarsa", "8"],
            ["Nilai persediaan", "Rp 182 jt"],
        ],
        columns: [
            "SKU",
            "Nama bahan",
            "Gudang",
            "On hand",
            "Minimum",
            "Status",
        ],
        rows: [
            [
                "RM-0042",
                "Daging sapi slice",
                "Gudang Utama",
                "2,4 kg",
                "5 kg",
                "Kritis",
            ],
            [
                "RM-0018",
                "Susu fresh milk",
                "Cold Storage",
                "8 ltr",
                "12 ltr",
                "Rendah",
            ],
            [
                "RM-0091",
                "Sirup vanilla",
                "Bar Storage",
                "3 btl",
                "5 btl",
                "Rendah",
            ],
        ],
    },
    "/purchasing": {
        label: "Purchasing",
        icon: Truck,
        description: "Kelola purchase request, PO, penerimaan, dan retur.",
        action: "Buat purchase order",
        stats: [
            ["PO aktif", "14"],
            ["Menunggu approval", "5"],
            ["Pengiriman minggu ini", "8"],
            ["Nilai pembelian", "Rp 76,4 jt"],
        ],
        columns: [
            "Nomor PO",
            "Supplier",
            "Tanggal",
            "Total",
            "Penerimaan",
            "Status",
        ],
        rows: [
            [
                "PO-2026-0078",
                "PT Boga Prima",
                "30 Jul 2026",
                "Rp 12.840.000",
                "Parsial",
                "Dikirim",
            ],
            [
                "PO-2026-0077",
                "CV Susu Segar",
                "29 Jul 2026",
                "Rp 5.600.000",
                "Belum",
                "Disetujui",
            ],
            [
                "PO-2026-0076",
                "Makmur Jaya",
                "28 Jul 2026",
                "Rp 8.125.000",
                "Penuh",
                "Selesai",
            ],
        ],
    },
    "/customers": {
        label: "Pelanggan",
        icon: Users,
        description: "Kelola profil, membership, dan riwayat pelanggan.",
        action: "Tambah pelanggan",
        stats: [
            ["Total pelanggan", "4.826"],
            ["Member aktif", "2.108"],
            ["Pelanggan baru", "126"],
            ["Repeat rate", "68%"],
        ],
        columns: [
            "Kode",
            "Nama",
            "Kontak",
            "Tier",
            "Poin",
            "Kunjungan terakhir",
        ],
        rows: [
            [
                "CUS-01824",
                "Ayu Lestari",
                "0812••••4402",
                "Gold",
                "2.480",
                "Hari ini",
            ],
            [
                "CUS-01823",
                "Budi Santoso",
                "0813••••7211",
                "Silver",
                "860",
                "Hari ini",
            ],
            [
                "CUS-01822",
                "Rina Wijaya",
                "0857••••8914",
                "Member",
                "320",
                "Kemarin",
            ],
        ],
    },
    "/promotions": {
        label: "Promo & Loyalty",
        icon: BadgePercent,
        description: "Atur voucher, promosi, tier, dan loyalty points.",
        action: "Buat campaign",
        stats: [
            ["Campaign aktif", "8"],
            ["Voucher digunakan", "342"],
            ["Poin diterbitkan", "28.640"],
            ["Redemption rate", "24%"],
        ],
        columns: [
            "Campaign",
            "Tipe",
            "Periode",
            "Terpakai",
            "Nilai benefit",
            "Status",
        ],
        rows: [
            ["LUNCH20", "Diskon persen", "1–31 Jul", "184", "20%", "Aktif"],
            [
                "WELCOME50",
                "Voucher nominal",
                "Tanpa batas",
                "92",
                "Rp 50.000",
                "Aktif",
            ],
            ["DOUBLEPOINT", "Loyalty", "25–31 Jul", "66", "2x poin", "Aktif"],
        ],
    },
    "/reports": {
        label: "Laporan",
        icon: BarChart3,
        description: "Analisis penjualan, margin, stok, waste, dan purchasing.",
        action: "Ekspor laporan",
        stats: [
            ["Penjualan bersih", "Rp 1,42 M"],
            ["Gross margin", "64,8%"],
            ["Food cost", "31,2%"],
            ["Waste", "1,6%"],
        ],
        columns: [
            "Laporan",
            "Periode",
            "Outlet",
            "Terakhir dibuat",
            "Format",
            "Status",
        ],
        rows: [
            [
                "Ringkasan Penjualan",
                "Juli 2026",
                "Semua outlet",
                "30 Jul, 09:10",
                "PDF / XLSX",
                "Siap",
            ],
            [
                "Inventory Valuation",
                "Juli 2026",
                "Jakarta Selatan",
                "30 Jul, 08:45",
                "XLSX",
                "Siap",
            ],
            [
                "Kitchen SLA",
                "Minggu ini",
                "Jakarta Selatan",
                "30 Jul, 08:30",
                "PDF",
                "Siap",
            ],
        ],
    },
    "/settings": {
        label: "Pengaturan",
        icon: Settings,
        description:
            "Konfigurasi outlet, pajak, pengguna, role, dan kebijakan operasi.",
        action: "Simpan perubahan",
        stats: [
            ["Pengguna aktif", "24"],
            ["Role", "8"],
            ["Perangkat", "16"],
            ["Outlet", "3"],
        ],
        columns: [
            "Konfigurasi",
            "Nilai",
            "Lingkup",
            "Diperbarui oleh",
            "Waktu",
            "Status",
        ],
        rows: [
            [
                "Stock deduction",
                "Sent to kitchen",
                "Jakarta Selatan",
                "Administrator",
                "Hari ini",
                "Aktif",
            ],
            [
                "Service charge",
                "5%",
                "Jakarta Selatan",
                "Administrator",
                "Hari ini",
                "Aktif",
            ],
            [
                "QR approval",
                "Tidak wajib",
                "Jakarta Selatan",
                "Outlet Manager",
                "Kemarin",
                "Aktif",
            ],
        ],
    },
};
Object.values(modulePageDefinitions).forEach((page) => {
    page.stats = page.stats.map(([label]) => [label, "0"]);
    page.rows = [];
});
const nav = [
    ["Dashboard Holding", "/", LayoutDashboard],
    ["Data Store", "/holding", Building2],
    ["Master Data", "/master-data", Boxes],
    ["Bahan & Harga", "/materials", CircleDollarSign],
    ["Produk & Resep", "/products", ClipboardList],
    ["Order Barang", "/purchase-orders", ShoppingBag],
    ["Brand Operation", "/brand-operation/requests", ShieldCheck],
    ["Penerimaan Barang", "/purchasing", Truck],
    ["Data Stok", "/stock", Package],
    ["Pergerakan Stok", "/inventory", Warehouse],
    ["Laporan", "/reports", BarChart3],
];
const fallback = {
    period: "Hari ini, 30 Jul 2026",
    outlet: "Jakarta Selatan",
    metrics: [],
    sales: [],
    channels: [],
    kitchen: [],
    stockAlerts: [],
    activities: [],
};
const metricIcons = [CircleDollarSign, ShoppingBag, Clock3, BarChart3];

function SalesChart({ data }) {
    if (!data.length) return null;
    const max = Math.max(...data.map((x) => x.amount));
    const pts = data
        .map(
            (x, i) =>
                `${i * (700 / (data.length - 1))},${130 - (x.amount / max) * 105}`,
        )
        .join(" ");
    return (
        <div className="chart-wrap">
            <svg viewBox="0 0 700 150" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor="#7c3aed"
                            stopOpacity=".28"
                        />
                        <stop
                            offset="100%"
                            stopColor="#7c3aed"
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>
                {[25, 60, 95, 130].map((y) => (
                    <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="700"
                        y2={y}
                        stroke="#eaf0f8"
                        strokeDasharray="4 5"
                    />
                ))}
                <polygon points={`0,140 ${pts} 700,140`} fill="url(#area)" />
                <polyline
                    points={pts}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="3"
                />
                {data.map((x, i) => (
                    <circle
                        key={x.hour}
                        cx={i * (700 / (data.length - 1))}
                        cy={130 - (x.amount / max) * 105}
                        r="4"
                        fill="#fff"
                        stroke="#7c3aed"
                        strokeWidth="3"
                    />
                ))}
            </svg>
            <div className="chart-labels">
                {data.map((x) => (
                    <span key={x.hour}>{x.hour}.00</span>
                ))}
            </div>
        </div>
    );
}

export function HoldingDashboardPage() {
    const [data, setData] = useState(fallback);
    const [range, setRange] = useState("Hari ini");
    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => r.json())
            .then(setData);
    }, []);
    return (
        <div className="content">
            <section className="welcome">
                <div>
                    <p className="eyebrow">OVERVIEW OPERASIONAL</p>
                    <h1>
                        Selamat pagi, Admin <span aria-hidden="true">&#128075;</span>
                    </h1>
                    <p>
                        Pantau performa bisnis dan operasional outlet Anda hari
                        ini.
                    </p>
                </div>
                <div className="filters">
                    <button>
                        <span className="pulse" />
                        Live
                    </button>
                    <button>
                        {data.outlet}
                        <ChevronDown size={15} />
                    </button>
                    <button>
                        {data.period}
                        <ChevronDown size={15} />
                    </button>
                </div>
            </section>
            <section className="metrics">
                {data.metrics.map((m, i) => {
                    const Icon = metricIcons[i];
                    return (
                        <article className="metric" key={m.label}>
                            <div className={`metric-icon icon-${i}`}>
                                <Icon />
                            </div>
                            <p>{m.label}</p>
                            <div className="metric-value">{m.value}</div>
                            <small>{m.change}</small>
                        </article>
                    );
                })}
            </section>
            <section className="empty-dashboard">
                <Boxes />
                <h2>Belum ada data operasional</h2>
                <p>
                    Mulai dari menu Master Data untuk menyiapkan kategori,
                    satuan, supplier, gudang, station, dan meja.
                </p>
                <a href="/master-data">
                    Buka Master Data <ArrowUpRight />
                </a>
            </section>
        </div>
    );
}

export function GenericModulePage({ page }) {
    const Icon = page.icon;
    const listView = useListView(page.rows || []);
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">
                        BACKOFFICE / {page.label.toUpperCase()}
                    </p>
                    <h1>{page.label}</h1>
                    <p>{page.description}</p>
                </div>
                <button className="primary-action">
                    {page.label === "Laporan" ? <Download /> : <Plus />}
                    {page.action}
                </button>
            </section>
            <section className="module-stats">
                {page.stats.map(([label, value], i) => (
                    <article key={label}>
                        <div className={`metric-icon icon-${i % 4}`}>
                            <Icon />
                        </div>
                        <div>
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </div>
                    </article>
                ))}
            </section>
            <section className="card data-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar {page.label}</h2>
                        <p>Belum ada data transaksi</p>
                    </div>
                    <div>
                        <button>
                            <SlidersHorizontal />
                            Filter
                        </button>
                        <button>
                            <Download />
                            Ekspor
                        </button>
                    </div>
                </div>
                <ListControls
                    view={listView}
                    placeholder={`Cari ${page.label.toLowerCase()}...`}
                />
                <div className="empty-state">
                    <ClipboardList />
                    <h3>Belum ada data {page.label.toLowerCase()}</h3>
                    <p>Data akan tampil setelah transaksi mulai digunakan.</p>
                </div>
            </section>
        </div>
    );
}

function HoldingPage() {
    const [data, setData] = useState({ stores: [], users: [], roles: [] });
    const [modal, setModal] = useState(null);
    const [error, setError] = useState("");
    const [storeForm, setStoreForm] = useState({
        code: "",
        name: "",
        address: "",
    });
    const [userForm, setUserForm] = useState({
        outlet_id: "",
        name: "",
        email: "",
        phone: "",
        position: "Store Manager",
        role: "store-manager",
        password: "Store123!",
    });
    const load = () =>
        fetch("/api/holding")
            .then((r) => r.json())
            .then(setData);
    useEffect(() => {
        void load();
    }, []);
    async function save(url, payload) {
        setError("");
        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify(payload),
        });
        if (!r.ok) {
            const b = await r.json();
            setError(Object.values(b.errors || {}).flat()[0] || b.message);
            return;
        }
        setModal(null);
        load();
    }
    return (
        <div className="content module-content">
            <section className="module-hero holding-hero">
                <div>
                    <p className="eyebrow">HOLDING CONTROL CENTER</p>
                    <h1>Store & Akun</h1>
                    <p>
                        Kelola seluruh cabang, pengguna store, role, dan akses
                        dari satu pusat kendali.
                    </p>
                </div>
                <div className="holding-actions">
                    <button onClick={() => setModal("store")}>
                        <Store />
                        Tambah store
                    </button>
                    <button
                        className="primary-action"
                        onClick={() => setModal("user")}
                    >
                        <UserRound />
                        Buat akun store
                    </button>
                </div>
            </section>
            <section className="holding-overview">
                <article>
                    <div className="holding-stat-icon">
                        <Building2 />
                    </div>
                    <div>
                        <span>Total store</span>
                        <strong>{data.stores.length}</strong>
                        <small>
                            {
                                data.stores.filter((s) => s.status === "active")
                                    .length
                            }{" "}
                            store aktif
                        </small>
                    </div>
                </article>
                <article>
                    <div className="holding-stat-icon users">
                        <Users />
                    </div>
                    <div>
                        <span>Akun terdaftar</span>
                        <strong>{data.users.length}</strong>
                        <small>Semua cabang</small>
                    </div>
                </article>
                <article>
                    <div className="holding-stat-icon roles">
                        <KeyRound />
                    </div>
                    <div>
                        <span>Role store</span>
                        <strong>{data.roles.length}</strong>
                        <small>Berbasis Spatie Permission</small>
                    </div>
                </article>
            </section>
            <section className="holding-grid">
                <article className="card">
                    <div className="data-toolbar">
                        <div>
                            <h2>Daftar store</h2>
                            <p>Unit bisnis di bawah POSphere Holding</p>
                        </div>
                        <button onClick={() => setModal("store")}>
                            <Plus />
                            Tambah
                        </button>
                    </div>
                    <div className="store-list">
                        {data.stores.map((s) => (
                            <div className="store-row" key={s.id}>
                                <div className="store-avatar">
                                    {s.code.slice(0, 2)}
                                </div>
                                <div>
                                    <strong>{s.name}</strong>
                                    <span>
                                        {s.code} ·{" "}
                                        {s.address || "Alamat belum diisi"}
                                    </span>
                                </div>
                                <span className="status-pill">{s.status}</span>
                            </div>
                        ))}
                    </div>
                </article>
                <article className="card">
                    <div className="data-toolbar">
                        <div>
                            <h2>Akun store</h2>
                            <p>Pengguna dan hak akses per cabang</p>
                        </div>
                        <button onClick={() => setModal("user")}>
                            <Plus />
                            Buat akun
                        </button>
                    </div>
                    <div className="account-list">
                        {data.users.map((u) => (
                            <div className="account-row" key={u.id}>
                                <div className="avatar">
                                    {u.name
                                        .split(" ")
                                        .map((x) => x[0])
                                        .slice(0, 2)
                                        .join("")}
                                </div>
                                <div>
                                    <strong>{u.name}</strong>
                                    <span>
                                        {u.email} · {u.outlet_name || "Holding"}
                                    </span>
                                </div>
                                <div>
                                    <span className="role-chip">{u.role}</span>
                                    <small>{u.position}</small>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>
            </section>
            {modal && (
                <div className="modal-backdrop">
                    <div className="form-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(null)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                {modal === "store" ? <Store /> : <UserRound />}
                            </div>
                            <h2>
                                {modal === "store"
                                    ? "Tambah store baru"
                                    : "Buat akun store"}
                            </h2>
                            <p>
                                {modal === "store"
                                    ? "Daftarkan cabang baru di bawah Holding."
                                    : "Tetapkan akun, store, dan role akses."}
                            </p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        {modal === "store" ? (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    save("/api/holding/stores", storeForm);
                                }}
                            >
                                <label>Kode store</label>
                                <input
                                    value={storeForm.code}
                                    onChange={(e) =>
                                        setStoreForm({
                                            ...storeForm,
                                            code: e.target.value,
                                        })
                                    }
                                    placeholder="Contoh: BDG"
                                    required
                                />
                                <label>Nama store</label>
                                <input
                                    value={storeForm.name}
                                    onChange={(e) =>
                                        setStoreForm({
                                            ...storeForm,
                                            name: e.target.value,
                                        })
                                    }
                                    placeholder="Bandung Dago"
                                    required
                                />
                                <label>Alamat</label>
                                <textarea
                                    value={storeForm.address}
                                    onChange={(e) =>
                                        setStoreForm({
                                            ...storeForm,
                                            address: e.target.value,
                                        })
                                    }
                                />
                                <button className="login-submit">
                                    Simpan store
                                </button>
                            </form>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    save("/api/holding/users", userForm);
                                }}
                            >
                                <label>Store</label>
                                <select
                                    value={userForm.outlet_id}
                                    onChange={(e) =>
                                        setUserForm({
                                            ...userForm,
                                            outlet_id: e.target.value,
                                        })
                                    }
                                    required
                                >
                                    <option value="">Pilih store</option>
                                    {data.stores.map((s) => (
                                        <option value={s.id} key={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="form-columns">
                                    <div>
                                        <label>Nama lengkap</label>
                                        <input
                                            value={userForm.name}
                                            onChange={(e) =>
                                                setUserForm({
                                                    ...userForm,
                                                    name: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label>Jabatan</label>
                                        <input
                                            value={userForm.position}
                                            onChange={(e) =>
                                                setUserForm({
                                                    ...userForm,
                                                    position: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                </div>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={userForm.email}
                                    onChange={(e) =>
                                        setUserForm({
                                            ...userForm,
                                            email: e.target.value,
                                        })
                                    }
                                    required
                                />
                                <div className="form-columns">
                                    <div>
                                        <label>Role</label>
                                        <select
                                            value={userForm.role}
                                            onChange={(e) =>
                                                setUserForm({
                                                    ...userForm,
                                                    role: e.target.value,
                                                })
                                            }
                                        >
                                            {data.roles.map((r) => (
                                                <option key={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Password awal</label>
                                        <input
                                            value={userForm.password}
                                            onChange={(e) =>
                                                setUserForm({
                                                    ...userForm,
                                                    password: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                </div>
                                <button className="login-submit">
                                    Buat akun store
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
