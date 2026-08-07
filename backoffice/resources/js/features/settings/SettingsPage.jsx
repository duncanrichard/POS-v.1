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
    Users,
    UserRound,
} from "lucide-react";
import { csrf, ListControls, useListView } from "../../shared/ui";

export function SettingsPage() {
    const [tab, setTab] = useState("accounts");
    const [data, setData] = useState({
        roles: [],
        permissions: [],
        accounts: [],
        stores: [],
        positions: [],
    });
    const [modal, setModal] = useState(null);
    const [error, setError] = useState("");
    const [form, setForm] = useState({});
    const settingsItems =
        tab === "accounts"
            ? data.accounts
            : tab === "roles"
              ? data.roles
              : data.permissions;
    const listView = useListView(settingsItems);
    const load = () =>
        fetch("/api/access")
            .then((r) => r.json())
            .then(setData);
    useEffect(() => {
        void load();
    }, []);
    function open(type) {
        setModal(type);
        setError("");
        setForm(
            type === "account"
                ? {
                      name: "",
                      email: "",
                      phone: "",
                      outlet_id: "",
                      position_id: "",
                      role: "store-manager",
                      account_channel: "backoffice",
                      password: "Store123!",
                  }
                : type === "role"
                  ? { name: "", permissions: [] }
                  : { name: "" },
        );
    }
    async function submit(e) {
        e.preventDefault();
        const endpoint =
            modal === "account"
                ? "accounts"
                : modal === "role"
                  ? "roles"
                  : "permissions";
        const r = await fetch(`/api/access/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify(form),
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
            <section className="module-hero">
                <div>
                    <p className="eyebrow">PENGATURAN / AKSES PENGGUNA</p>
                    <h1>Role, Permission & Akun</h1>
                    <p>
                        Atur siapa yang dapat masuk, store yang dikelola,
                        jabatan, dan fitur yang boleh digunakan.
                    </p>
                </div>
                <button
                    className="primary-action"
                    onClick={() =>
                        open(
                            tab === "accounts"
                                ? "account"
                                : tab === "roles"
                                  ? "role"
                                  : "permission",
                        )
                    }
                >
                    <Plus />
                    Tambah{" "}
                    {tab === "accounts"
                        ? "Akun"
                        : tab === "roles"
                          ? "Role"
                          : "Permission"}
                </button>
            </section>
            <div className="settings-tabs">
                <button
                    className={tab === "accounts" ? "active" : ""}
                    onClick={() => setTab("accounts")}
                >
                    <Users />
                    Akun Store
                </button>
                <button
                    className={tab === "roles" ? "active" : ""}
                    onClick={() => setTab("roles")}
                >
                    <ShieldCheck />
                    Role
                </button>
                <button
                    className={tab === "permissions" ? "active" : ""}
                    onClick={() => setTab("permissions")}
                >
                    <KeyRound />
                    Permission
                </button>
            </div>
            <section className="card access-card">
                <ListControls
                    view={listView}
                    placeholder={`Cari ${tab === "accounts" ? "akun" : tab === "roles" ? "role" : "permission"}...`}
                />
                {tab === "accounts" && (
                    <>
                        <div className="data-toolbar">
                            <div>
                                <h2>Akun Store</h2>
                                <p>
                                    Akun login terikat dengan store, jabatan,
                                    dan role
                                </p>
                            </div>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Email</th>
                                        <th>Store</th>
                                        <th>Jabatan</th>
                                        <th>Role</th>
                                        <th>Akses Login</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listView.rows.map((a) => (
                                        <tr key={a.id}>
                                            <td>
                                                <strong>{a.name}</strong>
                                            </td>
                                            <td>{a.email}</td>
                                            <td>
                                                {a.outlet_name || "Holding"}
                                            </td>
                                            <td>{a.position_name || "-"}</td>
                                            <td>
                                                <span className="role-chip">
                                                    {a.role}
                                                </span>
                                            </td>
                                            <td>
                                                {a.account_channel === "pos"
                                                    ? "POS"
                                                    : a.account_channel ===
                                                        "both"
                                                      ? "POS & Backoffice"
                                                      : "Backoffice"}
                                            </td>
                                            <td>
                                                <span className="status-pill">
                                                    {a.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {tab === "roles" && (
                    <>
                        <div className="data-toolbar">
                            <div>
                                <h2>Role Pengguna</h2>
                                <p>
                                    Kumpulan permission berdasarkan tanggung
                                    jawab pengguna
                                </p>
                            </div>
                        </div>
                        <div className="role-grid">
                            {listView.rows.map((r) => (
                                <article key={r.id}>
                                    <div>
                                        <ShieldCheck />
                                        <strong>{r.name}</strong>
                                    </div>
                                    <p>{r.permissions.length} permission</p>
                                    <div>
                                        {r.permissions.slice(0, 5).map((p) => (
                                            <span key={p}>{p}</span>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}
                {tab === "permissions" && (
                    <>
                        <div className="data-toolbar">
                            <div>
                                <h2>Daftar Permission</h2>
                                <p>
                                    Hak akses terkecil yang digunakan oleh role
                                </p>
                            </div>
                        </div>
                        <div className="permission-list">
                            {listView.rows.map((p) => (
                                <span key={p.id}>
                                    <KeyRound />
                                    {p.name}
                                </span>
                            ))}
                        </div>
                    </>
                )}
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
                                {modal === "account" ? (
                                    <UserRound />
                                ) : modal === "role" ? (
                                    <ShieldCheck />
                                ) : (
                                    <KeyRound />
                                )}
                            </div>
                            <h2>
                                Tambah{" "}
                                {modal === "account"
                                    ? "Akun Store"
                                    : modal === "role"
                                      ? "Role"
                                      : "Permission"}
                            </h2>
                            <p>Lengkapi data dan simpan perubahan.</p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            {modal === "account" && (
                                <>
                                    <label>Nama lengkap</label>
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
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                email: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                    <div className="form-columns">
                                        <div>
                                            <label>Store</label>
                                            <select
                                                value={form.outlet_id}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        outlet_id:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                            >
                                                <option value="">
                                                    Pilih store
                                                </option>
                                                {data.stores.map((x) => (
                                                    <option
                                                        value={x.id}
                                                        key={x.id}
                                                    >
                                                        {x.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label>Jabatan</label>
                                            <select
                                                value={form.position_id}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        position_id:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                            >
                                                <option value="">
                                                    Pilih jabatan
                                                </option>
                                                {data.positions.map((x) => (
                                                    <option
                                                        value={x.id}
                                                        key={x.id}
                                                    >
                                                        {x.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-columns">
                                        <div>
                                            <label>Akses aplikasi</label>
                                            <select
                                                value={form.account_channel}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        account_channel:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                            >
                                                <option value="backoffice">
                                                    Backoffice
                                                </option>
                                                <option value="pos">
                                                    POS Kasir
                                                </option>
                                                <option value="both">
                                                    POS & Backoffice
                                                </option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>Role</label>
                                            <select
                                                value={form.role}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        role: e.target.value,
                                                    })
                                                }
                                            >
                                                {data.roles
                                                    .filter(
                                                        (r) =>
                                                            r.name !==
                                                            "holding-admin",
                                                    )
                                                    .map((r) => (
                                                        <option key={r.id}>
                                                            {r.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label>Password awal</label>
                                            <input
                                                value={form.password}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        password:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            {modal === "role" && (
                                <>
                                    <label>Nama role</label>
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
                                    <label>Pilih permission</label>
                                    <div className="permission-checks">
                                        {data.permissions.map((p) => (
                                            <label key={p.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={(
                                                        form.permissions || []
                                                    ).includes(p.name)}
                                                    onChange={(e) =>
                                                        setForm({
                                                            ...form,
                                                            permissions: e
                                                                .target.checked
                                                                ? [
                                                                      ...(form.permissions ||
                                                                          []),
                                                                      p.name,
                                                                  ]
                                                                : (
                                                                      form.permissions ||
                                                                      []
                                                                  ).filter(
                                                                      (x) =>
                                                                          x !==
                                                                          p.name,
                                                                  ),
                                                        })
                                                    }
                                                />
                                                {p.name}
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                            {modal === "permission" && (
                                <>
                                    <label>Nama permission</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder="contoh: products.approve"
                                        required
                                    />
                                </>
                            )}
                            <button className="login-submit">Simpan</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
