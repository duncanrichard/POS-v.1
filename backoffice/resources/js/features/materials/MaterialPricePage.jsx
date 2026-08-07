import React, { useEffect, useState } from "react";
import Select from "react-select";
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
import { csrf, ListControls, rupiah, useListView } from "../../shared/ui";

export function MaterialPricePage() {
    const [rows, setRows] = useState([]);
    const [options, setOptions] = useState([]);
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        material_id: "",
        price: "",
        effective_from: new Date().toISOString().slice(0, 10),
        effective_until: "",
    });
    const view = useListView(rows);
    const load = () => {
        fetch("/api/material-prices")
            .then((r) => r.json())
            .then(setRows);
        fetch("/api/material-prices/options")
            .then((r) => r.json())
            .then(setOptions);
    };
    useEffect(() => {
        void load();
    }, []);
    const open = (row = null) => {
        setEditing(row);
        setError("");
        setModal(true);
        setForm(
            row
                ? {
                      material_id: row.material_id,
                      price: Number(row.price),
                      effective_from: row.effective_from,
                      effective_until: row.effective_until || "",
                  }
                : {
                      material_id: "",
                      price: "",
                      effective_from: new Date().toISOString().slice(0, 10),
                      effective_until: "",
                  },
        );
    };
    const submit = async (e) => {
        e.preventDefault();
        setError("");
        const response = await fetch(
            editing
                ? `/api/material-prices/${editing.id}`
                : "/api/material-prices",
            {
                method: editing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
                body: JSON.stringify({
                    ...form,
                    price: Number(form.price),
                    effective_until: form.effective_until || null,
                }),
            },
        );
        const body = await response.json();
        if (!response.ok)
            return setError(
                Object.values(body.errors || {}).flat()[0] || body.message,
            );
        setModal(false);
        load();
    };
    const remove = async (row) => {
        if (!confirm(`Hapus periode harga ${row.material_name}?`)) return;
        await fetch(`/api/material-prices/${row.id}`, {
            method: "DELETE",
            headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
        });
        load();
    };
    const statusLabel = {
        active: "Aktif",
        soon: "Akan Datang",
        expired: "Kedaluwarsa",
    };
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">MASTER DATA / PERIODE HARGA</p>
                    <h1>Harga Bahan</h1>
                    <p>
                        Kelola harga modal bahan berdasarkan periode berlaku.
                        Semua perubahan tersimpan otomatis sebagai snapshot.
                    </p>
                </div>
                <button className="primary-action" onClick={() => open()}>
                    <Plus /> Tambah Harga Bahan
                </button>
            </section>
            <section className="card data-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar Harga Bahan</h2>
                        <p>{rows.length} periode harga tersimpan</p>
                    </div>
                </div>
                <ListControls
                    view={view}
                    placeholder="Cari bahan, harga, atau status..."
                />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Nama Bahan</th>
                                <th>Satuan</th>
                                <th>Harga Modal</th>
                                <th>Tanggal Mulai</th>
                                <th>Tanggal Akhir</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {view.rows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <strong>{row.material_name}</strong>
                                    </td>
                                    <td>{row.unit_name || "-"}</td>
                                    <td>{rupiah(row.price)}</td>
                                    <td>{row.effective_from}</td>
                                    <td>
                                        {row.effective_until || "Tanpa batas"}
                                    </td>
                                    <td>
                                        <span
                                            className={`price-status ${row.price_status}`}
                                        >
                                            {statusLabel[row.price_status]}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button onClick={() => open(row)}>
                                                Edit
                                            </button>
                                            <button
                                                className="danger"
                                                onClick={() => remove(row)}
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!view.rows.length && (
                    <div className="empty-state">
                        <CircleDollarSign />
                        <h2>Belum ada harga bahan</h2>
                        <p>
                            Tambahkan periode harga modal untuk bahan pertama.
                        </p>
                    </div>
                )}
            </section>
            {modal && (
                <div className="modal-backdrop">
                    <section className="card price-modal material-price-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <CircleDollarSign />
                            <div>
                                <h2>
                                    {editing
                                        ? "Edit Harga Bahan"
                                        : "Tambah Harga Bahan"}
                                </h2>
                                <p>
                                    Tentukan nominal dan periode berlakunya
                                    harga.
                                </p>
                            </div>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit} className="price-form">
                            <label>
                                Bahan <b>*</b>
                            </label>
                            <Select
                                className="form-select2"
                                classNamePrefix="select2"
                                isSearchable
                                isDisabled={Boolean(editing)}
                                placeholder="Cari dan pilih bahan..."
                                value={
                                    options
                                        .map((x) => ({
                                            value: x.id,
                                            label: x.name,
                                        }))
                                        .find(
                                            (x) => x.value === form.material_id,
                                        ) || null
                                }
                                options={options.map((x) => ({
                                    value: x.id,
                                    label: `${x.name} · ${x.unit_name || "Tanpa satuan"}`,
                                }))}
                                onChange={(x) =>
                                    setForm({
                                        ...form,
                                        material_id: x?.value || "",
                                    })
                                }
                            />
                            <div className="form-grid">
                                <label>
                                    Harga modal
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.000001"
                                        value={form.price}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                price: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </label>
                                <label>
                                    Tanggal mulai
                                    <input
                                        type="date"
                                        value={form.effective_from}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                effective_from: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </label>
                                <label>
                                    Tanggal akhir <small>(opsional)</small>
                                    <input
                                        type="date"
                                        min={form.effective_from}
                                        value={form.effective_until}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                effective_until: e.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>
                            <div className="period-note">
                                <Clock3 /> Kosongkan tanggal akhir jika harga
                                berlaku tanpa batas.
                            </div>
                            <button className="login-submit">
                                Simpan Harga & Snapshot
                            </button>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
