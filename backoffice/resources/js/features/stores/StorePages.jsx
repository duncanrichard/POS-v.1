import React, { useEffect, useState } from "react";
import Select from "react-select";
import {
    CircleMarker,
    MapContainer,
    TileLayer,
    useMapEvents,
} from "react-leaflet";
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
} from "lucide-react";
import { csrf, ListControls, useListView } from "../../shared/ui";

function MapClickHandler({ onPick }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function CoordinatePicker({ latitude, longitude, onChange }) {
    const lat = Number(latitude) || -6.2;
    const lng = Number(longitude) || 106.816666;
    function currentLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((p) =>
            onChange(p.coords.latitude, p.coords.longitude),
        );
    }
    return (
        <div className="coordinate-picker">
            <div className="map-toolbar">
                <span>
                    <MapPin />
                    Klik peta untuk menentukan titik store
                </span>
                <button type="button" onClick={currentLocation}>
                    <LocateFixed />
                    Gunakan lokasi saya
                </button>
            </div>
            <MapContainer
                key={`${lat}-${lng}`}
                center={[lat, lng]}
                zoom={14}
                scrollWheelZoom
                className="store-map"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                    center={[lat, lng]}
                    radius={10}
                    pathOptions={{
                        color: "#0d6efd",
                        fillColor: "#7c3aed",
                        fillOpacity: 0.9,
                    }}
                />
                <MapClickHandler onPick={onChange} />
            </MapContainer>
        </div>
    );
}

function StoreMapOverview({ stores }) {
    const located = stores.filter((s) => s.latitude && s.longitude);
    if (!located.length) return null;
    const center = [Number(located[0].latitude), Number(located[0].longitude)];
    return (
        <section className="card store-map-card">
            <div className="data-toolbar">
                <div>
                    <h2>Peta Lokasi Store</h2>
                    <p>{located.length} store memiliki titik koordinat</p>
                </div>
            </div>
            <MapContainer
                center={center}
                zoom={11}
                scrollWheelZoom
                className="overview-map"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {located.map((s) => (
                    <CircleMarker
                        key={s.id}
                        center={[Number(s.latitude), Number(s.longitude)]}
                        radius={9}
                        pathOptions={{
                            color: "#0d6efd",
                            fillColor: "#7c3aed",
                            fillOpacity: 0.9,
                        }}
                    />
                ))}
            </MapContainer>
        </section>
    );
}

function StorePage() {
    const [stores, setStores] = useState([]);
    const [modal, setModal] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        code: "Dibuat otomatis",
        name: "",
        address: "",
        latitude: -6.2,
        longitude: 106.816666,
    });
    const load = () =>
        fetch("/api/holding/stores")
            .then((r) => r.json())
            .then((x) => setStores(x.stores || []));
    useEffect(() => {
        void load();
    }, []);
    useEffect(() => {
        if (!modal || !form.latitude || !form.longitude) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const query = new URLSearchParams({
                    latitude: form.latitude,
                    longitude: form.longitude,
                });
                const response = await fetch(
                    `/api/geocoding/reverse?${query}`,
                    {
                        signal: controller.signal,
                        headers: { Accept: "application/json" },
                    },
                );
                if (response.ok) {
                    const result = await response.json();
                    setForm((current) => ({
                        ...current,
                        address: result.address || current.address,
                    }));
                }
            } catch (error) {
                if (error.name !== "AbortError")
                    console.warn("Alamat tidak dapat ditemukan", error);
            }
        }, 650);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [modal, form.latitude, form.longitude]);
    async function submit(e) {
        e.preventDefault();
        const { code, ...payload } = form;
        const r = await fetch("/api/holding/stores", {
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
        setModal(false);
        setForm({
            code: "Dibuat otomatis",
            name: "",
            address: "",
            latitude: -6.2,
            longitude: 106.816666,
        });
        load();
    }
    return (
        <div className="content module-content">
            <section className="module-hero holding-hero">
                <div>
                    <p className="eyebrow">HOLDING / MASTER STORE</p>
                    <h1>Data Store</h1>
                    <p>
                        Kelola identitas, alamat, dan titik koordinat seluruh
                        store pada peta.
                    </p>
                </div>
                <button
                    className="primary-action"
                    onClick={() => setModal(true)}
                >
                    <Plus />
                    Tambah Store
                </button>
            </section>
            <section className="holding-overview store-summary">
                <article>
                    <div className="holding-stat-icon">
                        <Building2 />
                    </div>
                    <div>
                        <span>Total store</span>
                        <strong>{stores.length}</strong>
                        <small>
                            {stores.filter((s) => s.status === "active").length}{" "}
                            store aktif
                        </small>
                    </div>
                </article>
            </section>
            <section className="card store-only-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar Store</h2>
                        <p>Unit bisnis yang berada di bawah Holding</p>
                    </div>
                    <button onClick={() => setModal(true)}>
                        <Plus />
                        Tambah Store
                    </button>
                </div>
                {stores.length ? (
                    <div className="store-list">
                        {stores.map((s) => (
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
                                    {s.latitude && (
                                        <small className="coordinate-text">
                                            <MapPin />
                                            {s.latitude}, {s.longitude}
                                        </small>
                                    )}
                                </div>
                                <span className="status-pill">{s.status}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Store />
                        <h3>Belum ada store</h3>
                        <p>
                            Tambahkan store pertama untuk memulai operasional.
                        </p>
                    </div>
                )}
            </section>
            <StoreMapOverview stores={stores} />
            {modal && (
                <div className="modal-backdrop">
                    <div className="form-modal map-form-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <MapPin />
                            </div>
                            <h2>Tambah Store Baru</h2>
                            <p>
                                Lengkapi data dan pilih titik store pada peta.
                            </p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            <div className="form-columns">
                                <div>
                                    <label>Kode store</label>
                                    <input
                                        value={form.code}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                code: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label>Nama store</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <label>Alamat lengkap</label>
                            <textarea
                                value={form.address}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        address: e.target.value,
                                    })
                                }
                            />
                            <div className="form-columns">
                                <div>
                                    <label>Latitude</label>
                                    <input
                                        type="number"
                                        step="0.0000001"
                                        min="-90"
                                        max="90"
                                        value={form.latitude}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                latitude: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label>Longitude</label>
                                    <input
                                        type="number"
                                        step="0.0000001"
                                        min="-180"
                                        max="180"
                                        value={form.longitude}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                longitude: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <CoordinatePicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                onChange={(latitude, longitude) =>
                                    setForm({
                                        ...form,
                                        latitude: Number(latitude.toFixed(7)),
                                        longitude: Number(longitude.toFixed(7)),
                                    })
                                }
                            />
                            <button className="login-submit">
                                Simpan Store & Koordinat
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export function StoreManagementPage() {
    const emptyForm = {
        name: "",
        address: "",
        latitude: -6.2,
        longitude: 106.816666,
        status: "active",
    };
    const [stores, setStores] = useState([]);
    const listView = useListView(stores);
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyForm);
    const load = () =>
        fetch("/api/holding/stores")
            .then((r) => r.json())
            .then((x) => setStores(x.stores || []));
    useEffect(() => {
        void load();
    }, []);
    useEffect(() => {
        if (!modal || !form.latitude || !form.longitude) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const query = new URLSearchParams({
                    latitude: form.latitude,
                    longitude: form.longitude,
                });
                const response = await fetch(
                    `/api/geocoding/reverse?${query}`,
                    {
                        signal: controller.signal,
                        headers: { Accept: "application/json" },
                    },
                );
                if (response.ok) {
                    const result = await response.json();
                    setForm((current) => ({
                        ...current,
                        address: result.address || current.address,
                    }));
                }
            } catch (error) {
                if (error.name !== "AbortError") console.warn(error);
            }
        }, 650);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [modal, form.latitude, form.longitude]);
    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setError("");
        setModal(true);
    }
    function openEdit(store) {
        setEditing(store);
        setForm({
            name: store.name,
            address: store.address || "",
            latitude: store.latitude,
            longitude: store.longitude,
            status: store.status,
        });
        setError("");
        setModal(true);
    }
    async function submit(e) {
        e.preventDefault();
        const response = await fetch(
            editing
                ? `/api/holding/stores/${editing.id}`
                : "/api/holding/stores",
            {
                method: editing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
                body: JSON.stringify(form),
            },
        );
        if (!response.ok) {
            const body = await response.json();
            setError(
                Object.values(body.errors || {}).flat()[0] || body.message,
            );
            return;
        }
        setModal(false);
        load();
    }
    async function remove(store) {
        if (!window.confirm(`Hapus store ${store.name}?`)) return;
        const response = await fetch(`/api/holding/stores/${store.id}`, {
            method: "DELETE",
            headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
        });
        const body = await response.json();
        if (!response.ok) {
            window.alert(body.message);
            return;
        }
        load();
    }
    return (
        <div className="content module-content">
            <section className="module-hero holding-hero">
                <div>
                    <p className="eyebrow">HOLDING / MASTER STORE</p>
                    <h1>Data Store</h1>
                    <p>
                        Kelola identitas, alamat, dan titik koordinat seluruh
                        store pada peta.
                    </p>
                </div>
                <button className="primary-action" onClick={openCreate}>
                    <Plus />
                    Tambah Store
                </button>
            </section>
            <section className="holding-overview store-summary">
                <article>
                    <div className="holding-stat-icon">
                        <Building2 />
                    </div>
                    <div>
                        <span>Total store</span>
                        <strong>{stores.length}</strong>
                        <small>
                            {stores.filter((s) => s.status === "active").length}{" "}
                            store aktif
                        </small>
                    </div>
                </article>
            </section>
            <section className="card store-only-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar Store</h2>
                        <p>Unit bisnis yang berada di bawah Holding</p>
                    </div>
                </div>
                {stores.length ? (
                    <div className="store-list">
                        <ListControls
                            view={listView}
                            placeholder="Cari kode, nama, atau alamat Store..."
                        />
                        {listView.rows.map((store) => (
                            <div
                                className="store-row store-row-actions"
                                key={store.id}
                            >
                                <div className="store-avatar">
                                    {store.code.slice(0, 2)}
                                </div>
                                <div>
                                    <strong>{store.name}</strong>
                                    <span>
                                        #
                                        {String(store.store_number).padStart(
                                            4,
                                            "0",
                                        )}{" "}
                                        · {store.code} ·{" "}
                                        {store.address || "Alamat belum diisi"}
                                    </span>
                                    {store.latitude && (
                                        <small className="coordinate-text">
                                            <MapPin />
                                            {store.latitude}, {store.longitude}
                                        </small>
                                    )}
                                </div>
                                <span
                                    className={`status-pill status-${store.status}`}
                                >
                                    {store.status}
                                </span>
                                <div className="store-actions">
                                    <button onClick={() => openEdit(store)}>
                                        <Pencil />
                                        Edit
                                    </button>
                                    <button
                                        className="danger"
                                        onClick={() => remove(store)}
                                    >
                                        <Trash2 />
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Store />
                        <h3>Belum ada store</h3>
                        <p>Gunakan tombol Tambah Store pada bagian atas.</p>
                    </div>
                )}
            </section>
            <StoreMapOverview stores={stores} />
            {modal && (
                <div className="modal-backdrop">
                    <div className="form-modal map-form-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <MapPin />
                            </div>
                            <h2>
                                {editing ? "Edit Store" : "Tambah Store Baru"}
                            </h2>
                            <p>
                                {editing
                                    ? `${editing.code} · Nomor #${String(editing.store_number).padStart(4, "0")}`
                                    : "Kode store akan dibuat otomatis oleh sistem."}
                            </p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            <label>Nama store</label>
                            <input
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                            <label>Alamat lengkap</label>
                            <textarea
                                value={form.address}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        address: e.target.value,
                                    })
                                }
                            />
                            <div className="form-columns">
                                <div>
                                    <label>Latitude</label>
                                    <input
                                        type="number"
                                        step="0.0000001"
                                        min="-90"
                                        max="90"
                                        value={form.latitude}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                latitude: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label>Longitude</label>
                                    <input
                                        type="number"
                                        step="0.0000001"
                                        min="-180"
                                        max="180"
                                        value={form.longitude}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                longitude: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            {editing && (
                                <>
                                    <label>Status store</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                status: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="active">Aktif</option>
                                        <option value="inactive">
                                            Tidak aktif
                                        </option>
                                    </select>
                                </>
                            )}
                            <CoordinatePicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                onChange={(latitude, longitude) =>
                                    setForm({
                                        ...form,
                                        latitude: Number(latitude.toFixed(7)),
                                        longitude: Number(longitude.toFixed(7)),
                                    })
                                }
                            />
                            <button className="login-submit">
                                {editing ? "Simpan Perubahan" : "Simpan Store"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
