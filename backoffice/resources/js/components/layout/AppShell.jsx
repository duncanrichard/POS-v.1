import React, { useEffect, useState } from "react";
import {
    LayoutDashboard,
    ShoppingBag,
    ChefHat,
    Package,
    Truck,
    BarChart3,
    Settings,
    Bell,
    Search,
    ChevronDown,
    ArrowUpRight,
    Clock3,
    CircleDollarSign,
    AlertTriangle,
    Menu,
    X,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    LogOut,
    Plus,
    CheckCircle2,
    ClipboardList,
    Warehouse,
    Boxes,
    ReceiptText,
    ShieldCheck,
    Building2,
    Store,
    KeyRound,
    MapPin,
    LocateFixed,
    Pencil,
    Trash2,
    BadgePercent,
    PackagePlus,
    Users,
    CreditCard,
} from "lucide-react";
import { csrf } from "../../shared/ui";

const nav = [
    ["Dashboard Holding", "/", LayoutDashboard],
    ["Data Store", "/holding", Building2],
    ["Master Data", "/master-data", Boxes],
    ["Bahan & Harga", "/materials", CircleDollarSign],
    ["Produk & Resep", "/products", ClipboardList],
    ["Produk Promo", "/product-promotions", BadgePercent],
    ["Produk Bundling", "/product-bundles", PackagePlus],
    ["Order Barang", "/purchase-orders", ShoppingBag],
    [
        "Brand Operation",
        "/brand-operation/requests",
        ShieldCheck,
        [["Permintaan Barang", "/brand-operation/requests", ClipboardList]],
    ],
    ["Penerimaan Barang", "/purchasing", Truck],
    ["Data Stok", "/stock", Package],
    ["Pergerakan Stok", "/inventory", Warehouse],
    ["Laporan", "/reports", BarChart3, [
        ["Ringkasan Laporan", "/reports", BarChart3],
        ["Omzet Cabang Harian", "/reports/outlet-daily", Building2],
        ["Penjualan per Staff", "/reports/staff", Users],
        ["Metode Pembayaran", "/reports/payments", CreditCard],
        ["Produk Terlaris", "/reports/products", ReceiptText],
        ["Shift Kasir", "/reports/shifts", Clock3],
    ]],
    ["Pengaturan", "/settings", Settings],
];

function Logo({ dark = false }) {
    return (
        <div className={`brand ${dark ? "dark" : ""}`}>
            <div className="brand-mark">P</div>
            <div>
                POS<span>phere</span>
            </div>
        </div>
    );
}

export function LoginPage() {
    const [form, setForm] = useState({
        email: "admin@posphere.id",
        password: "Posphere123!",
        remember: true,
    });
    const [show, setShow] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        const res = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify(form),
        });
        if (res.ok) window.location.href = "/";
        else {
            const body = await res.json();
            setError(
                body.errors?.email?.[0] || "Login gagal. Silakan coba kembali.",
            );
            setLoading(false);
        }
    }
    return (
        <div className="login-page">
            <section className="login-visual">
                <Logo />
                <div className="login-copy">
                    <p className="eyebrow light">BACKOFFICE F&B TERINTEGRASI</p>
                    <h1>
                        Satu kendali untuk seluruh{" "}
                        <span>operasional bisnis.</span>
                    </h1>
                    <p>
                        Pantau penjualan, kitchen, inventory, purchasing, dan
                        pelanggan secara realtime dari satu tempat.
                    </p>
                    <div className="login-points">
                        <div>
                            <CheckCircle2 />
                            <span>Data operasional realtime</span>
                        </div>
                        <div>
                            <CheckCircle2 />
                            <span>Multi-outlet & multi-role</span>
                        </div>
                        <div>
                            <CheckCircle2 />
                            <span>Aman dan dapat diaudit</span>
                        </div>
                    </div>
                </div>
                <div className="visual-orbit orbit-one" />
                <div className="visual-orbit orbit-two" />
                <small>© 2026 POSphere. Sistem operasional F&B modern.</small>
            </section>
            <section className="login-panel">
                <div className="mobile-logo">
                    <Logo dark />
                </div>
                <form onSubmit={submit}>
                    <div className="login-heading">
                        <div className="secure-icon">
                            <ShieldCheck />
                        </div>
                        <h2>Selamat datang kembali</h2>
                        <p>Masuk untuk melanjutkan ke dashboard backoffice.</p>
                    </div>
                    {error && (
                        <div className="login-error">
                            <AlertTriangle size={17} />
                            {error}
                        </div>
                    )}
                    <label>Email</label>
                    <div className="input-wrap">
                        <Mail />
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) =>
                                setForm({ ...form, email: e.target.value })
                            }
                            required
                        />
                    </div>
                    <label>Password</label>
                    <div className="input-wrap">
                        <LockKeyhole />
                        <input
                            type={show ? "text" : "password"}
                            value={form.password}
                            onChange={(e) =>
                                setForm({ ...form, password: e.target.value })
                            }
                            required
                        />
                        <button type="button" onClick={() => setShow(!show)}>
                            {show ? <EyeOff /> : <Eye />}
                        </button>
                    </div>
                    <div className="login-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={form.remember}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        remember: e.target.checked,
                                    })
                                }
                            />{" "}
                            Ingat saya
                        </label>
                        <a href="#">Lupa password?</a>
                    </div>
                    <button className="login-submit" disabled={loading}>
                        {loading ? "Memverifikasi..." : "Masuk ke Backoffice"}
                        <ArrowUpRight />
                    </button>
                    <div className="demo-account">
                        <strong>Akun demo sudah terisi</strong>
                        <span>
                            Gunakan kredensial default untuk mulai menjelajah.
                        </span>
                    </div>
                </form>
            </section>
        </div>
    );
}

function Sidebar({ open, close, path, user, pendingRequests = 0 }) {
    const [openGroups, setOpenGroups] = useState(() => ({
        brandOperation: path.startsWith("/brand-operation"),
    }));
    async function logout() {
        await fetch("/logout", {
            method: "POST",
            headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
        });
        window.location.href = "/login";
    }
    return (
        <aside className={`sidebar ${open ? "open" : ""}`}>
            <Logo />
            <button className="close-mobile" onClick={close}>
                <X />
            </button>
            <div className="workspace">
                <div className="workspace-icon">HQ</div>
                <div>
                    <strong>POSphere Holding</strong>
                    <small>
                        {user?.scope === "store"
                            ? "Akses store"
                            : "Semua store"}
                    </small>
                </div>
                <ChevronDown size={16} />
            </div>
            <p className="nav-label">MENU HOLDING</p>
            <nav>
                {nav
                    .filter(
                        ([label]) =>
                            label !== "Holding" || user?.scope !== "store",
                    )
                    .map(([label, url, Icon, children]) => (
                        <div
                            className={`nav-entry ${children ? "has-submenu" : ""}`}
                            key={url}
                        >
                            {children ? (
                                <button
                                    type="button"
                                    className={`nav-group-toggle ${path.startsWith("/brand-operation") ? "active" : ""}`}
                                    onClick={() =>
                                        setOpenGroups((current) => ({
                                            ...current,
                                            brandOperation:
                                                !current.brandOperation,
                                        }))
                                    }
                                    aria-expanded={openGroups.brandOperation}
                                >
                                    <Icon size={19} />
                                    <span>{label}</span>
                                    {pendingRequests > 0 && (
                                        <b>
                                            {pendingRequests > 99
                                                ? "99+"
                                                : pendingRequests}
                                        </b>
                                    )}
                                    <ChevronDown
                                        size={16}
                                        className={`submenu-chevron ${openGroups.brandOperation ? "open" : ""}`}
                                    />
                                </button>
                            ) : (
                                <a
                                    href={url}
                                    className={
                                        path === url ||
                                        (url === "/master-data" &&
                                            path === "/promotions")
                                            ? "active"
                                            : ""
                                    }
                                >
                                    <Icon size={19} />
                                    <span>{label}</span>
                                </a>
                            )}
                            {children && openGroups.brandOperation && (
                                <div className="nav-submenu">
                                    {children.map(([childLabel, childUrl]) => (
                                        <a
                                            href={childUrl}
                                            className={
                                                path === childUrl
                                                    ? "active"
                                                    : ""
                                            }
                                            key={childUrl}
                                        >
                                            <i className="submenu-dot" />
                                            <span>{childLabel}</span>
                                            {pendingRequests > 0 && (
                                                <b>
                                                    {pendingRequests > 99
                                                        ? "99+"
                                                        : pendingRequests}
                                                </b>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
            </nav>
            <div className="sidebar-bottom">
                <div className="support">
                    <div className="support-icon">?</div>
                    <strong>Butuh bantuan?</strong>
                    <p>Tim support siap membantu operasional Anda.</p>
                    <button>Pusat bantuan</button>
                </div>
                <div className="profile">
                    <div className="avatar">HA</div>
                    <div>
                        <strong>{user?.name || "Administrator"}</strong>
                        <small>
                            {user?.scope === "store"
                                ? "Akun Store"
                                : "Holding Admin"}
                        </small>
                    </div>
                    <button
                        className="logout-icon"
                        onClick={logout}
                        title="Keluar"
                    >
                        <LogOut size={17} />
                    </button>
                </div>
            </div>
        </aside>
    );
}

function Header({ openMenu, user, notifications, loadNotifications }) {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    async function logout() {
        if (loggingOut) return;
        setLoggingOut(true);

        try {
            const response = await fetch("/logout", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error("Logout gagal.");
            }

            window.location.replace("/login");
        } catch {
            setLoggingOut(false);
            window.alert(
                "Tidak dapat keluar dari sesi. Muat ulang halaman lalu coba kembali.",
            );
        }
    }
    const toggleNotifications = async () => {
        setShowNotifications(!showNotifications);
    };
    const openNotification = async (event, item) => {
        event.preventDefault();
        if (!item.read_at) {
            await fetch(`/api/purchase-orders/notifications/${item.id}/read`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
            });
            await loadNotifications();
        }
        window.location.href = "/brand-operation/requests";
    };
    return (
        <header>
            <button className="menu-btn" onClick={openMenu}>
                <Menu />
            </button>
            <div className="search">
                <Search size={18} />
                <input placeholder="Cari order, produk, pelanggan..." />
                <kbd>Ctrl K</kbd>
            </div>
            <div className="header-actions">
                <button
                    className={`icon-btn notification-bell ${notifications.unread > 0 ? "has-notification" : ""}`}
                    onClick={toggleNotifications}
                    title={`${notifications.unread} notifikasi belum dibaca`}
                >
                    <Bell />
                    {notifications.unread > 0 && (
                        <b>
                            {notifications.unread > 99
                                ? "99+"
                                : notifications.unread}
                        </b>
                    )}
                </button>
                {showNotifications && (
                    <div className="notification-popover">
                        <div>
                            <strong>Notifikasi Order</strong>
                            <a href="/brand-operation/requests">Lihat semua</a>
                        </div>
                        {notifications.items.length ? (
                            notifications.items.slice(0, 6).map((item) => (
                                <a
                                    href="/brand-operation/requests"
                                    className={!item.read_at ? "unread" : ""}
                                    key={item.id}
                                    onClick={(event) =>
                                        openNotification(event, item)
                                    }
                                >
                                    <Bell />
                                    <span>
                                        <strong>{item.title}</strong>
                                        <small>
                                            {item.outlet_name} · {item.message}
                                        </small>
                                    </span>
                                </a>
                            ))
                        ) : (
                            <p>Belum ada notifikasi order.</p>
                        )}
                    </div>
                )}
                <div className="header-account">
                    <button
                        type="button"
                        className="header-user"
                        onClick={() => setShowAccountMenu((open) => !open)}
                        aria-expanded={showAccountMenu}
                        aria-haspopup="menu"
                    >
                        <div className="avatar">AP</div>
                        <span>{user?.name || "Administrator"}</span>
                        <ChevronDown
                            size={15}
                            className={showAccountMenu ? "open" : ""}
                        />
                    </button>
                    {showAccountMenu && (
                        <div className="header-account-menu" role="menu">
                            <div>
                                <strong>{user?.name || "Administrator"}</strong>
                                <small>{user?.email}</small>
                            </div>
                            <button
                                type="button"
                                onClick={logout}
                                disabled={loggingOut}
                                role="menuitem"
                            >
                                <LogOut size={17} />
                                {loggingOut ? "Sedang keluar..." : "Keluar ke halaman login"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export function AppShell({ children, path }) {
    const [menu, setMenu] = useState(false);
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [notifications, setNotifications] = useState({
        unread: 0,
        pending: 0,
        items: [],
    });
    const loadNotifications = () =>
        fetch("/api/purchase-orders/notifications")
            .then((response) =>
                response.ok
                    ? response.json()
                    : { unread: 0, pending: 0, items: [] },
            )
            .then(setNotifications);
    useEffect(() => {
        fetch("/api/me", {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
        })
            .then((response) => {
                if (response.status === 401) {
                    window.location.replace("/login");
                    return null;
                }

                if (!response.ok) {
                    throw new Error("Sesi Backoffice tidak dapat diperiksa.");
                }

                return response.json();
            })
            .then((currentUser) => {
                if (currentUser) setUser(currentUser);
            })
            .finally(() => setAuthChecked(true));
    }, []);
    useEffect(() => {
        loadNotifications();
        const timer = setInterval(loadNotifications, 5000);
        return () => clearInterval(timer);
    }, []);
    if (!authChecked || !user) {
        return <div className="auth-loading">Memeriksa sesi...</div>;
    }

    return (
        <div className="app-shell">
            <Sidebar
                open={menu}
                close={() => setMenu(false)}
                path={path}
                user={user}
                pendingRequests={notifications.unread}
            />
            {menu && <div className="overlay" onClick={() => setMenu(false)} />}
            <main>
                <Header
                    openMenu={() => setMenu(true)}
                    user={user}
                    notifications={notifications}
                    loadNotifications={loadNotifications}
                />
                {children}
            </main>
        </div>
    );
}
