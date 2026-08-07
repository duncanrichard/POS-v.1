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
import {
    csrf,
    decimalQty,
    ListControls,
    rupiah,
    useListView,
} from "../../shared/ui";

export function PurchaseOrdersPage() {
    const [stores, setStores] = useState([]);
    const [store, setStore] = useState("");
    const [rows, setRows] = useState([]);
    const listView = useListView(rows);
    const [options, setOptions] = useState({
        categories: [],
        items: [],
    });
    const [modal, setModal] = useState(false);
    const [invoice, setInvoice] = useState(null);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        expected_date: "",
        items: [
            {
                item_category_id: "",
                material_id: "",
                quantity: 1,
                unit_id: "",
                unit_cost: 0,
            },
        ],
    });
    useEffect(() => {
        fetch("/api/me")
            .then((r) => r.json())
            .then((me) => {
                if (me.outlet_id) {
                    setStore(me.outlet_id);
                    if (me.outlet) setStores([me.outlet]);
                }
                if (me.scope === "holding")
                    fetch("/api/holding/stores")
                        .then((r) => r.json())
                        .then((x) => {
                            setStores(x.stores);
                        });
            });
    }, []);
    const load = () => {
        fetch(`/api/purchase-orders${store ? `?outlet_id=${store}` : ""}`)
            .then((r) => r.json())
            .then(setRows);
    };
    useEffect(() => {
        void load();
    }, [store]);
    useEffect(() => {
        if (store) {
            fetch(`/api/purchase-orders/options?outlet_id=${store}`)
                .then((r) => r.json())
                .then(setOptions);
        } else {
            setOptions({ categories: [], items: [] });
        }
    }, [store]);
    function updatePoItem(index, changes) {
        setForm({
            ...form,
            items: form.items.map((item, i) =>
                i === index ? { ...item, ...changes } : item,
            ),
        });
    }
    function selectPurchaseItem(index, id) {
        const item = options.items.find((x) => x.id === id);
        updatePoItem(index, {
            material_id: id,
            item_category_id: item?.item_category_id || "",
            unit_cost: Number(item?.average_cost || 0),
            unit_id: item?.unit_id || "",
        });
    }
    async function openInvoice(id) {
        const response = await fetch(
            `/api/purchase-orders/${id}?outlet_id=${store}`,
        );
        if (response.ok) setInvoice(await response.json());
    }
    async function submit(e) {
        e.preventDefault();
        if (!store)
            return setError(
                "Pilih Store yang melakukan order terlebih dahulu.",
            );
        if (
            form.items.some(
                (item) => !item.item_category_id || !item.material_id,
            )
        )
            return setError(
                "Lengkapi kategori dan barang pada seluruh baris order.",
            );
        const payload = {
            outlet_id: store,
            expected_date: form.expected_date || null,
            items: form.items.map((item) => ({
                ...item,
                quantity: Number(item.quantity),
                unit_cost: Number(item.unit_cost),
            })),
        };
        const r = await fetch("/api/purchase-orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify(payload),
        });
        const b = await r.json();
        if (!r.ok) {
            setError(Object.values(b.errors || {}).flat()[0] || b.message);
            return;
        }
        setModal(false);
        load();
        openInvoice(b.id);
    }
    async function submitPo(id, outletId) {
        await fetch(`/api/purchase-orders/${id}/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify({ outlet_id: outletId || store }),
        });
        load();
    }
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">LANGKAH 2 / PURCHASING</p>
                    <h1>Order Barang</h1>
                    <p>
                        Cabang mengirim kebutuhan barang ke pusat. Supplier akan
                        ditentukan oleh tim pusat.
                    </p>
                </div>
                <button
                    className="primary-action"
                    onClick={() => setModal(true)}
                >
                    <Plus />
                    Buat Purchase Order
                </button>
            </section>
            <div className="process-steps">
                <div className="done">
                    <span>1</span>
                    <strong>Siapkan master data</strong>
                    <small>Produk, supplier, satuan</small>
                </div>
                <i>→</i>
                <div className="active">
                    <span>2</span>
                    <strong>Buat order barang</strong>
                    <small>Draft dan ajukan PO</small>
                </div>
                <i>→</i>
                <div>
                    <span>3</span>
                    <strong>Terima barang</strong>
                    <small>Catat qty diterima</small>
                </div>
                <i>→</i>
                <div>
                    <span>4</span>
                    <strong>Stok bertambah</strong>
                    <small>Ledger otomatis</small>
                </div>
            </div>
            <section className="card data-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar Purchase Order</h2>
                        <p>{rows.length} dokumen order barang</p>
                    </div>
                    <Select
                        className="store-select2"
                        classNamePrefix="select2"
                        value={
                            stores
                                .map((outlet) => ({
                                    value: outlet.id,
                                    label: `${outlet.code} - ${outlet.name}`,
                                }))
                                .find((option) => option.value === store) ||
                            null
                        }
                        options={stores.map((outlet) => ({
                            value: outlet.id,
                            label: `${outlet.code} - ${outlet.name}`,
                        }))}
                        onChange={(option) => setStore(option?.value || "")}
                        placeholder="Semua Store"
                        isSearchable
                        isClearable
                    />
                </div>
                <ListControls
                    view={listView}
                    placeholder="Cari nomor PO, barang, atau Store..."
                />
                {listView.rows.length ? (
                    <div className="table-wrap">
                        <table className="purchase-orders-table">
                            <thead>
                                <tr>
                                    <th>Nomor PO</th>
                                    {!store && <th>Store</th>}
                                    <th>Supplier dari Pusat</th>
                                    <th>Invoice</th>
                                    <th>Barang</th>
                                    <th>Tanggal dibuat</th>
                                    <th>Estimasi datang</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listView.rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <strong>{r.po_number}</strong>
                                        </td>
                                        {!store && <td>{r.outlet_name}</td>}
                                        <td>{r.supplier_name}</td>
                                        <td>{r.invoice_number || "-"}</td>
                                        <td>{r.item_count} barang</td>
                                        <td>
                                            {new Date(
                                                r.created_at,
                                            ).toLocaleDateString("id-ID")}
                                        </td>
                                        <td>{r.expected_date || "-"}</td>
                                        <td>
                                            Rp{" "}
                                            {Number(
                                                r.grand_total,
                                            ).toLocaleString("id-ID")}
                                        </td>
                                        <td>
                                            <span className="status-pill">
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="po-action invoice"
                                                    onClick={() =>
                                                        openInvoice(r.id)
                                                    }
                                                    title="Lihat invoice"
                                                >
                                                    <ReceiptText size={15} />
                                                    Invoice
                                                </button>
                                                {r.status === "draft" && (
                                                    <button
                                                        className="po-action submit"
                                                        onClick={() =>
                                                            submitPo(
                                                                r.id,
                                                                r.outlet_id,
                                                            )
                                                        }
                                                    >
                                                        <ArrowUpRight size={15} />
                                                        Ajukan
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <ShoppingBag />
                        <h3>Belum ada order barang</h3>
                        <p>
                            Pilih Store dan masukkan barang yang dibutuhkan
                            untuk membuat order pertama.
                        </p>
                        <button onClick={() => setModal(true)}>
                            <Plus />
                            Buat Purchase Order
                        </button>
                    </div>
                )}
            </section>
            {modal && (
                <div className="modal-backdrop">
                    <div className="form-modal purchase-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <ShoppingBag />
                            </div>
                            <h2>Purchase Order Baru</h2>
                            <p>
                                Pilih Store, kategori, barang, dan jumlah
                                kebutuhan cabang.
                            </p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit} className="purchase-order-form">
                            <div className="po-section-title">
                                <b>1</b>
                                <span>
                                    <strong>Pilih Store Pemesan</strong>
                                    <small>
                                        Order dan pilihan barang akan mengikuti
                                        Store ini.
                                    </small>
                                </span>
                            </div>
                            <label>
                                Store yang melakukan order <b>*</b>
                            </label>
                            <Select
                                className="form-select2"
                                classNamePrefix="select2"
                                value={
                                    stores
                                        .map((outlet) => ({
                                            value: outlet.id,
                                            label: `${outlet.code} - ${outlet.name}`,
                                        }))
                                        .find(
                                            (option) => option.value === store,
                                        ) || null
                                }
                                options={stores.map((outlet) => ({
                                    value: outlet.id,
                                    label: `${outlet.code} - ${outlet.name}`,
                                }))}
                                onChange={(option) => {
                                    setStore(option?.value || "");
                                    setForm({
                                        expected_date: form.expected_date,
                                        items: [
                                            {
                                                item_category_id: "",
                                                material_id: "",
                                                quantity: 1,
                                                unit_id: "",
                                                unit_cost: 0,
                                            },
                                        ],
                                    });
                                }}
                                placeholder="Cari dan pilih store..."
                                noOptionsMessage={() => "Store tidak ditemukan"}
                                isSearchable
                            />
                            <div
                                className={`po-order-content ${store ? "ready" : "locked"}`}
                            >
                                <div className="po-section-title">
                                    <b>2</b>
                                    <span>
                                        <strong>Informasi Kebutuhan</strong>
                                        <small>
                                            Supplier akan ditentukan oleh pusat
                                            setelah order diajukan.
                                        </small>
                                    </span>
                                </div>
                                <div className="po-info-grid single">
                                    <div>
                                        <label>Estimasi tanggal datang</label>
                                        <input
                                            type="date"
                                            disabled={!store}
                                            min={new Date()
                                                .toISOString()
                                                .slice(0, 10)}
                                            value={form.expected_date}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    expected_date:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div
                                className={`po-order-content ${store ? "ready" : "locked"}`}
                            >
                                <div className="po-section-title">
                                    <b>3</b>
                                    <span>
                                        <strong>Barang yang Dipesan</strong>
                                        <small>
                                            Pilih kategori terlebih dahulu,
                                            kemudian pilih barang dan jumlahnya.
                                        </small>
                                    </span>
                                </div>
                                <div className="po-items-heading">
                                    <strong>
                                        {form.items.length} barang dalam order
                                    </strong>
                                    <button
                                        type="button"
                                        disabled={!store}
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                items: [
                                                    ...form.items,
                                                    {
                                                        item_category_id: "",
                                                        material_id: "",
                                                        quantity: 1,
                                                        unit_id: "",
                                                        unit_cost: 0,
                                                    },
                                                ],
                                            })
                                        }
                                    >
                                        <Plus /> Tambah Barang
                                    </button>
                                </div>
                                <div className="po-item-head">
                                    <span>Kategori</span>
                                    <span>Barang</span>
                                    <span>Qty</span>
                                    <span>Harga</span>
                                    <span>Subtotal</span>
                                    <span />
                                </div>
                                {form.items.map((item, index) => {
                                    const availableItems = options.items.filter(
                                        (entry) =>
                                            !item.item_category_id ||
                                            entry.item_category_id ===
                                                item.item_category_id,
                                    );
                                    return (
                                        <div
                                            className="po-item-row"
                                            key={index}
                                        >
                                            <Select
                                                className="form-select2"
                                                classNamePrefix="select2"
                                                value={
                                                    options.categories
                                                        .map((x) => ({
                                                            value: x.id,
                                                            label: x.name,
                                                        }))
                                                        .find(
                                                            (x) =>
                                                                x.value ===
                                                                item.item_category_id,
                                                        ) || null
                                                }
                                                options={options.categories.map(
                                                    (x) => ({
                                                        value: x.id,
                                                        label: x.name,
                                                    }),
                                                )}
                                                onChange={(option) =>
                                                    updatePoItem(index, {
                                                        item_category_id:
                                                            option?.value || "",
                                                        material_id: "",
                                                    })
                                                }
                                                placeholder="Pilih kategori"
                                                isSearchable
                                            />
                                            <Select
                                                className="form-select2"
                                                classNamePrefix="select2"
                                                value={
                                                    availableItems
                                                        .map((x) => ({
                                                            value: x.id,
                                                            label: `${x.name} · ${x.unit_code} · ${rupiah(x.average_cost)}`,
                                                        }))
                                                        .find(
                                                            (x) =>
                                                                x.value ===
                                                                item.material_id,
                                                        ) || null
                                                }
                                                options={availableItems.map(
                                                    (x) => ({
                                                        value: x.id,
                                                        label: `${x.name} · ${x.unit_code} · ${rupiah(x.average_cost)}`,
                                                    }),
                                                )}
                                                onChange={(option) =>
                                                    selectPurchaseItem(
                                                        index,
                                                        option?.value || "",
                                                    )
                                                }
                                                placeholder="Pilih barang"
                                                isSearchable
                                            />
                                            <input
                                                type="number"
                                                min="0.0001"
                                                step="0.0001"
                                                value={item.quantity}
                                                onChange={(e) =>
                                                    updatePoItem(index, {
                                                        quantity:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                                title={`Jumlah dalam ${options.items.find((x) => x.id === item.material_id)?.unit_code || "satuan bahan"}`}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.unit_cost}
                                                onChange={(e) =>
                                                    updatePoItem(index, {
                                                        unit_cost:
                                                            e.target.value,
                                                    })
                                                }
                                                required
                                            />
                                            <strong>
                                                {rupiah(
                                                    Number(item.quantity || 0) *
                                                        Number(
                                                            item.unit_cost || 0,
                                                        ),
                                                )}
                                            </strong>
                                            <button
                                                type="button"
                                                disabled={
                                                    form.items.length === 1
                                                }
                                                onClick={() =>
                                                    setForm({
                                                        ...form,
                                                        items: form.items.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                    })
                                                }
                                            >
                                                <Trash2 />
                                            </button>
                                        </div>
                                    );
                                })}
                                <div className="po-grand-total">
                                    Total Purchase Order{" "}
                                    <strong>
                                        {rupiah(
                                            form.items.reduce(
                                                (sum, item) =>
                                                    sum +
                                                    Number(item.quantity || 0) *
                                                        Number(
                                                            item.unit_cost || 0,
                                                        ),
                                                0,
                                            ),
                                        )}
                                    </strong>
                                </div>
                            </div>
                            <button className="login-submit">
                                <CheckCircle2 /> Simpan Order Barang
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <PurchaseInvoice
                invoice={invoice}
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}

function PurchaseInvoice({ invoice, onClose }) {
    if (!invoice) return null;
    return (
        <div className="modal-backdrop invoice-backdrop">
            <div className="invoice-sheet">
                <button className="modal-close no-print" onClick={onClose}>
                    <X />
                </button>
                <div className="invoice-brand">
                    <div>
                        <span>POSPHERE · DOKUMEN RESMI</span>
                        <h2>INVOICE / PERMINTAAN PEMBELIAN</h2>
                    </div>
                    <div className="invoice-document-number">
                        <small>NOMOR DOKUMEN</small>
                        <strong>{invoice.invoice_number}</strong>
                        <em>{String(invoice.status).toUpperCase()}</em>
                    </div>
                </div>
                <div className="invoice-info">
                    <div>
                        <small>STORE</small>
                        <strong>{invoice.outlet_name}</strong>
                        <span>{invoice.outlet_address}</span>
                    </div>
                    <div>
                        <small>SUPPLIER</small>
                        <strong>
                            {invoice.supplier_name || "Belum ditentukan pusat"}
                        </strong>
                        <span>
                            {invoice.supplier_phone ||
                                invoice.supplier_email ||
                                "-"}
                        </span>
                    </div>
                    <div>
                        <small>NOMOR PO</small>
                        <strong>{invoice.po_number}</strong>
                        <span>
                            {new Date(invoice.created_at).toLocaleDateString(
                                "id-ID",
                            )}
                        </span>
                    </div>
                </div>
                <table className="invoice-table">
                    <thead>
                        <tr>
                            <th>Kategori</th>
                            <th>Kode</th>
                            <th>Barang</th>
                            <th>Qty</th>
                            <th>Harga</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item) => (
                            <tr key={item.id}>
                                <td>{item.category_name}</td>
                                <td>{item.sku}</td>
                                <td>{item.item_name}</td>
                                <td>
                                    {decimalQty(item.ordered_qty)}{" "}
                                    {item.unit_code}
                                </td>
                                <td>{rupiah(item.unit_cost)}</td>
                                <td>{rupiah(item.line_total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="invoice-total">
                    <span>GRAND TOTAL</span>
                    <strong>{rupiah(invoice.grand_total)}</strong>
                </div>
                <div className="invoice-approval">
                    <div>
                        <span>Dibuat oleh</span>
                        <strong>Cabang / Store</strong>
                        <i>Tanda tangan & tanggal</i>
                    </div>
                    <div>
                        <span>Diperiksa oleh</span>
                        <strong>Purchasing Pusat</strong>
                        <i>Tanda tangan & tanggal</i>
                    </div>
                    <div>
                        <span>Disetujui oleh</span>
                        <strong>Holding / Manajemen</strong>
                        <i>Tanda tangan & tanggal</i>
                    </div>
                </div>
                <p className="invoice-footer">
                    Dokumen ini dibuat secara elektronik oleh POSphere.
                    Penetapan supplier dan persetujuan dilakukan oleh pusat.
                </p>
                <button
                    className="primary-action invoice-print no-print"
                    onClick={() => window.print()}
                >
                    <ReceiptText /> Cetak Invoice
                </button>
            </div>
        </div>
    );
}

export function OrderRequestsPage() {
    const [rows, setRows] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [message, setMessage] = useState("");
    const view = useListView(rows);
    const load = () =>
        fetch("/api/purchase-orders?status=submitted")
            .then((r) => r.json())
            .then(setRows);
    useEffect(() => {
        load();
        const timer = setInterval(load, 5000);
        return () => clearInterval(timer);
    }, []);
    const detail = async (row) => {
        const response = await fetch(`/api/purchase-orders/${row.id}`);
        if (response.ok) setInvoice(await response.json());
    };
    const decide = async (row, decision) => {
        const action = decision === "approve" ? "menyetujui" : "menolak";
        if (!window.confirm(`Yakin ingin ${action} ${row.po_number}?`)) return;
        setProcessingId(row.id);
        setMessage("");
        const response = await fetch(
            `/api/purchase-orders/${row.id}/decision`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
                body: JSON.stringify({ decision }),
            },
        );
        const body = await response.json();
        setProcessingId(null);
        setMessage(body.message || "Permintaan gagal diproses.");
        if (response.ok) load();
    };
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">BRAND OPERATION / PERMINTAAN BARANG</p>
                    <h1>Permintaan Barang</h1>
                    <p>
                        Daftar kebutuhan barang yang telah diajukan cabang dan
                        menunggu tindak lanjut pusat.
                    </p>
                </div>
            </section>
            {message && <div className="success-banner">{message}</div>}
            <section className="card data-card brand-requests-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Order Masuk dari Cabang</h2>
                        <p>{rows.length} permintaan menunggu diproses</p>
                    </div>
                    <span className="live-indicator">
                        <i /> Diperbarui otomatis
                    </span>
                </div>
                <ListControls
                    view={view}
                    placeholder="Cari nomor order atau Store..."
                />
                {view.rows.length ? (
                    <div className="table-wrap">
                        <table className="brand-requests-table">
                            <thead>
                                <tr>
                                    <th>Nomor Order</th>
                                    <th>Store Pemesan</th>
                                    <th>Tanggal Pengajuan</th>
                                    <th>Estimasi Datang</th>
                                    <th>Jumlah Barang</th>
                                    <th>Total Estimasi</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {view.rows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <strong>{row.po_number}</strong>
                                        </td>
                                        <td>{row.outlet_name}</td>
                                        <td>
                                            {new Date(
                                                row.updated_at,
                                            ).toLocaleString("id-ID")}
                                        </td>
                                        <td>{row.expected_date || "-"}</td>
                                        <td>{row.item_count} barang</td>
                                        <td>{rupiah(row.grand_total)}</td>
                                        <td>
                                            <span className="status-pill">
                                                Menunggu Pusat
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="request-action detail"
                                                    onClick={() => detail(row)}
                                                    title="Lihat detail permintaan"
                                                >
                                                    <Eye size={15} /> Detail
                                                </button>
                                                <button
                                                    className="request-action approve"
                                                    disabled={processingId === row.id}
                                                    onClick={() => decide(row, "approve")}
                                                    title="Setujui permintaan"
                                                >
                                                    <CheckCircle2 size={15} /> Setujui
                                                </button>
                                                <button
                                                    className="request-action danger"
                                                    disabled={processingId === row.id}
                                                    onClick={() => decide(row, "reject")}
                                                    title="Tolak permintaan"
                                                >
                                                    <X size={15} /> Tolak
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Bell />
                        <h3>Belum ada permintaan order</h3>
                        <p>
                            Order yang diajukan cabang akan muncul otomatis di
                            halaman ini.
                        </p>
                    </div>
                )}
            </section>
            <PurchaseInvoice
                invoice={invoice}
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}

export function GoodsReceiptPage() {
    const [data, setData] = useState({ orders: [], receipts: [] });
    const [stores, setStores] = useState([]);
    const [store, setStore] = useState("");
    const [userScope, setUserScope] = useState("");
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [warehouseId, setWarehouseId] = useState("");
    const [items, setItems] = useState([]);
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const [receiptDetail, setReceiptDetail] = useState(null);
    const receiptView = useListView(data.receipts || []);
    const load = (outletId = store) => {
        if (!outletId) {
            setData({ orders: [], receipts: [] });
            return Promise.resolve();
        }
        return fetch(`/api/goods-receipts?outlet_id=${outletId}`)
            .then((r) => (r.ok ? r.json() : { orders: [], receipts: [] }))
            .then(setData);
    };
    useEffect(() => {
        fetch("/api/me")
            .then((response) => response.json())
            .then((me) => {
                setUserScope(me.scope || "");
                if (me.outlet_id) {
                    setStore(me.outlet_id);
                    if (me.outlet) setStores([me.outlet]);
                } else if (me.scope === "holding") {
                    fetch("/api/holding/stores")
                        .then((response) => response.json())
                        .then((body) => setStores(body.stores || []));
                }
            });
    }, []);
    useEffect(() => {
        setSelectedOrder(null);
        setDetailData(null);
        setWarehouseId("");
        setItems([]);
        void load(store);
    }, [store]);
    const chooseOrder = async (option) => {
        setSelectedOrder(option);
        setError("");
        setMessage("");
        if (!option) {
            setDetailData(null);
            setItems([]);
            return;
        }
        const response = await fetch(
            `/api/goods-receipts/purchase-orders/${option.value}`,
        );
        const body = await response.json();
        if (!response.ok) {
            setError(body.message || "Detail order gagal dimuat.");
            return;
        }
        setDetailData(body);
        setWarehouseId(body.warehouses?.[0]?.id || "");
        setItems(
            body.items
                .filter((item) => Number(item.remaining_qty) > 0)
                .map((item) => ({
                    ...item,
                    accepted_qty: Number(item.remaining_qty),
                    rejected_qty: 0,
                    qc_note: "",
                })),
        );
    };
    const updateItem = (index, key, value) =>
        setItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [key]: value } : item,
            ),
        );
    const submitReceipt = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        setSaving(true);
        const response = await fetch("/api/goods-receipts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify({
                purchase_order_id: selectedOrder?.value,
                warehouse_id: warehouseId,
                notes,
                items: items.map((item) => ({
                    purchase_order_item_id: item.id,
                    accepted_qty: Number(item.accepted_qty || 0),
                    rejected_qty: Number(item.rejected_qty || 0),
                    qc_note: item.qc_note,
                })),
            }),
        });
        const body = await response.json();
        setSaving(false);
        if (!response.ok) {
            setError(
                Object.values(body.errors || {})?.[0]?.[0] ||
                    body.message ||
                    "Penerimaan gagal disimpan.",
            );
            return;
        }
        setMessage(`${body.receipt_number} berhasil diposting. Stok telah diperbarui.`);
        setSelectedOrder(null);
        setDetailData(null);
        setItems([]);
        setNotes("");
        await load(store);
    };
    const orderOptions = data.orders.map((order) => ({
        value: order.id,
        label: `${order.po_number} · ${order.outlet_name} · ${order.supplier_name}`,
    }));
    const openReceipt = async (id) => {
        const response = await fetch(`/api/goods-receipts/${id}`);
        if (response.ok) setReceiptDetail(await response.json());
    };
    const selectedWarehouse = detailData?.warehouses?.find(
        (warehouse) => warehouse.id === warehouseId,
    );
    return (
        <div className="content module-content goods-receipt-page">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">CABANG / PENERIMAAN & QC</p>
                    <h1>Penerimaan Barang</h1>
                    <p>
                        Cocokkan barang datang dengan PO yang telah disetujui pusat.
                        Hanya qty lolos QC yang menambah stok.
                    </p>
                </div>
            </section>
            {error && <div className="form-alert"><AlertTriangle />{error}</div>}
            {message && <div className="success-banner">{message}</div>}
            <div className="receipt-flow-overview">
                <div className={store ? "done" : "active"}><span>{store ? <CheckCircle2 /> : "1"}</span><div><strong>Pilih Store</strong><small>Tentukan cabang penerima</small></div></div>
                <i>→</i>
                <div className={selectedOrder ? "done" : store ? "active" : ""}><span>{selectedOrder ? <CheckCircle2 /> : "2"}</span><div><strong>Pilih Order</strong><small>PO approved dari pusat</small></div></div>
                <i>→</i>
                <div className={warehouseId ? "done" : selectedOrder ? "active" : ""}><span>{warehouseId ? <CheckCircle2 /> : "3"}</span><div><strong>Gudang Penerima</strong><small>Lokasi stok tujuan</small></div></div>
                <i>→</i>
                <div className={detailData ? "active" : ""}><span>4</span><div><strong>QC & Posting</strong><small>Periksa lalu simpan stok</small></div></div>
            </div>
            <section className="card receipt-workspace">
                <div className="receipt-selection-grid">
                    <div className={`receipt-selection-panel ${store ? "selected" : ""}`}>
                        <div className="receipt-selection-head"><span>1</span><div><h2>Store penerima</h2><p>Pilih cabang tempat barang datang.</p></div></div>
                        <Select
                            className="receipt-store-select"
                            classNamePrefix="select2"
                            value={stores.map((outlet) => ({ value: outlet.id, label: `${outlet.code} - ${outlet.name}` })).find((option) => option.value === store) || null}
                            options={stores.map((outlet) => ({ value: outlet.id, label: `${outlet.code} - ${outlet.name}` }))}
                            onChange={(option) => setStore(option?.value || "")}
                            placeholder="Cari dan pilih Store..."
                            isSearchable
                            isClearable={userScope === "holding"}
                            isDisabled={userScope === "store"}
                        />
                        <small className="selection-helper"><Building2 /> Order dan gudang akan difilter berdasarkan Store.</small>
                    </div>
                    <div className={`receipt-selection-panel ${!store ? "disabled" : selectedOrder ? "selected" : ""}`}>
                        <div className="receipt-selection-head"><span>2</span><div><h2>Order yang datang</h2><p>Pilih PO yang sudah disetujui pusat.</p></div></div>
                        <Select
                            className="receipt-order-select"
                            classNamePrefix="select2"
                            value={selectedOrder}
                            options={orderOptions}
                            onChange={chooseOrder}
                            placeholder="Cari nomor PO..."
                            isSearchable
                            isClearable
                            isDisabled={!store}
                            noOptionsMessage={() => store ? "Tidak ada order approved untuk Store ini" : "Pilih Store terlebih dahulu"}
                        />
                        <small className="selection-helper"><ClipboardList /> Hanya PO approved yang belum selesai diterima.</small>
                    </div>
                </div>
                {detailData && (
                    <form onSubmit={submitReceipt} className="receipt-form">
                        <div className="receipt-summary">
                            <div><small>NOMOR ORDER</small><strong>{detailData.order.po_number}</strong></div>
                            <div><small>STORE PENERIMA</small><strong>{detailData.order.outlet_name}</strong></div>
                            <div><small>ESTIMASI DATANG</small><strong>{detailData.order.expected_date || "-"}</strong></div>
                        </div>
                        <div className="warehouse-destination">
                            <div className="warehouse-destination-icon"><Warehouse /></div>
                            <div className="warehouse-destination-copy">
                                <div className="warehouse-title-row">
                                    <div>
                                        <span className="receipt-step-number">3</span>
                                        <h2>Gudang penerima</h2>
                                    </div>
                                    <b>DITENTUKAN OTOMATIS</b>
                                </div>
                                <p>Barang yang lolos QC akan langsung menambah saldo stok pada gudang ini.</p>
                                {!detailData.warehouses.length ? (
                                    <div className="warehouse-empty"><AlertTriangle />Store ini belum memiliki gudang aktif. Tambahkan gudang di Master Data terlebih dahulu.</div>
                                ) : selectedWarehouse && (
                                    <div className="warehouse-selected automatic">
                                        <CheckCircle2 />
                                        <span><small>Barang masuk ke gudang</small><strong>{selectedWarehouse.code} - {selectedWarehouse.name}</strong></span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="receipt-step-head second">
                            <span>4</span>
                            <div><h2>QC barang datang</h2><p>Masukkan qty baik dan qty ditolak sesuai pemeriksaan fisik.</p></div>
                        </div>
                        <div className="table-wrap">
                            <table className="receipt-qc-table">
                                <thead><tr><th>Barang</th><th>Qty Order</th><th>Sisa</th><th>Qty Lolos QC</th><th>Qty Ditolak</th><th>Hasil</th><th>Catatan QC</th></tr></thead>
                                <tbody>
                                    {items.map((item, index) => {
                                        const issue = Number(item.rejected_qty) > 0;
                                        return (
                                            <tr key={item.id}>
                                                <td><strong>{item.material_name}</strong><small>{item.unit_code}</small></td>
                                                <td>{decimalQty(item.ordered_qty)}</td>
                                                <td>{decimalQty(item.remaining_qty)}</td>
                                                <td><input type="number" min="0" max={item.remaining_qty} step="0.0001" value={item.accepted_qty} onChange={(e) => updateItem(index, "accepted_qty", e.target.value)} /></td>
                                                <td><input className={issue ? "has-issue" : ""} type="number" min="0" max={item.remaining_qty} step="0.0001" value={item.rejected_qty} onChange={(e) => updateItem(index, "rejected_qty", e.target.value)} /></td>
                                                <td><span className={`qc-badge ${issue ? "issue" : "passed"}`}>{issue ? "Ada selisih" : "Sesuai"}</span></td>
                                                <td><input type="text" placeholder={issue ? "Wajib isi alasan" : "Opsional"} required={issue} value={item.qc_note} onChange={(e) => updateItem(index, "qc_note", e.target.value)} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <label className="receipt-notes">Catatan penerimaan<textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan umum kondisi pengiriman..." /></label>
                        <div className="receipt-post-note"><ShieldCheck />Penyimpanan akan membuat dokumen penerimaan, detail QC, pergerakan stok, dan relasi ke PO secara otomatis.</div>
                        <button className="primary-action receipt-submit" disabled={saving || !items.length || !warehouseId}><CheckCircle2 />{saving ? "Memposting stok..." : "Simpan QC & Masukkan Stok"}</button>
                    </form>
                )}
            </section>
            <section className="card data-card receipt-history">
                <div className="data-toolbar"><div><h2>Riwayat Penerimaan</h2><p>{data.receipts.length} dokumen penerimaan tersimpan</p></div></div>
                <ListControls view={receiptView} placeholder="Cari nomor penerimaan atau PO..." />
                {receiptView.rows.length ? <div className="table-wrap"><table><thead><tr><th>Nomor Penerimaan</th><th>Nomor PO</th><th>Store</th><th>Tanggal</th><th>QC</th><th>Status Stok</th><th>Aksi</th></tr></thead><tbody>
                    {receiptView.rows.map((receipt) => <tr key={receipt.id}><td><strong>{receipt.receipt_number}</strong></td><td>{receipt.po_number}</td><td>{receipt.outlet_name}</td><td>{new Date(receipt.received_at).toLocaleString("id-ID")}</td><td><span className={`qc-badge ${receipt.qc_status}`}>{receipt.qc_status === "passed" ? "Sesuai" : "Ada selisih"}</span></td><td><span className="status-pill">Sudah masuk stok</span></td><td><button className="table-action" onClick={() => openReceipt(receipt.id)}>Lihat Detail</button></td></tr>)}
                </tbody></table></div> : <div className="receipt-empty-state"><ReceiptText /><h3>Belum ada penerimaan barang</h3><p>Pilih Store dan order approved di atas untuk membuat dokumen penerimaan pertama.</p></div>}
            </section>
            {receiptDetail && (
                <div className="form-overlay" onClick={() => setReceiptDetail(null)}>
                    <div className="form-modal receipt-detail-modal" onClick={(event) => event.stopPropagation()}>
                        <button className="modal-close" onClick={() => setReceiptDetail(null)}><X /></button>
                        <div className="modal-heading"><ReceiptText /><div><h2>Detail Penerimaan</h2><p>Relasi dokumen dan hasil QC barang.</p></div></div>
                        <div className="receipt-detail-header">
                            <div><small>Nomor Penerimaan</small><strong>{receiptDetail.header.receipt_number}</strong></div>
                            <div><small>Nomor Order Asal</small><strong>{receiptDetail.header.po_number}</strong></div>
                            <div><small>Store / Gudang</small><strong>{receiptDetail.header.outlet_name} · {receiptDetail.header.warehouse_name}</strong></div>
                            <div><small>Diterima oleh</small><strong>{receiptDetail.header.received_by_name || "-"}</strong></div>
                        </div>
                        <div className="table-wrap"><table><thead><tr><th>Barang</th><th>Qty Order</th><th>Diterima</th><th>Ditolak</th><th>QC</th><th>Catatan</th></tr></thead><tbody>
                            {receiptDetail.items.map((item) => <tr key={item.id}><td><strong>{item.material_name}</strong><br/><small>{item.sku}</small></td><td>{decimalQty(item.ordered_qty)} {item.unit_code}</td><td>{decimalQty(item.accepted_qty)}</td><td>{decimalQty(item.rejected_qty)}</td><td><span className={`qc-badge ${item.qc_status}`}>{item.qc_status === "passed" ? "Sesuai" : "Ditolak"}</span></td><td>{item.qc_note || "-"}</td></tr>)}
                        </tbody></table></div>
                    </div>
                </div>
            )}
        </div>
    );
}
