import React, { useEffect, useMemo, useState } from "react";
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
import {
    decimalQty,
    ListControls,
    rupiah,
    useListView,
} from "../../shared/ui";

export function StockPage() {
    const [stores, setStores] = useState([]);
    const [store, setStore] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [data, setData] = useState({
        balances: [],
        summary: { sku: 0, value: 0 },
    });
    const filteredBalances = useMemo(
        () =>
            statusFilter
                ? (data.balances || []).filter(
                      (balance) => balance.stock_status === statusFilter,
                  )
                : data.balances || [],
        [data.balances, statusFilter],
    );
    const listView = useListView(filteredBalances);
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
    useEffect(() => {
        fetch(`/api/stock${store ? `?outlet_id=${store}` : ""}`)
            .then((r) => r.json())
            .then(setData);
    }, [store]);
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">LANGKAH 4 / INVENTORY</p>
                    <h1>Data Stok</h1>
                    <p>
                        Lihat saldo bahan per gudang. Saldo berubah dari
                        penerimaan, pemakaian resep, waste, transfer, dan
                        opname.
                    </p>
                </div>
                <Select
                    className="stock-store-filter"
                    classNamePrefix="select2"
                    value={stores.map((outlet) => ({ value: outlet.id, label: `${outlet.code} - ${outlet.name}` })).find((option) => option.value === store) || null}
                    options={stores.map((outlet) => ({ value: outlet.id, label: `${outlet.code} - ${outlet.name}` }))}
                    onChange={(option) => setStore(option?.value || "")}
                    placeholder="Semua Store"
                    isSearchable
                    isClearable
                />
            </section>
            <section className="module-stats stock-stats">
                <article>
                    <div className="metric-icon icon-0">
                        <Package />
                    </div>
                    <div>
                        <span>Total SKU tersimpan</span>
                        <strong>{data.summary.sku || 0}</strong>
                        <small>Tercatat di seluruh gudang</small>
                    </div>
                </article>
                <article>
                    <div className="metric-icon icon-1">
                        <CircleDollarSign />
                    </div>
                    <div>
                        <span>Nilai persediaan</span>
                        <strong>
                            Rp{" "}
                            {Number(data.summary.value || 0).toLocaleString(
                                "id-ID",
                            )}
                        </strong>
                        <small>Nilai stok berdasarkan modal</small>
                    </div>
                </article>
                <article className="stock-stat-alert">
                    <div className="metric-icon stock-critical-icon"><AlertTriangle /></div>
                    <div><span>Stok kritis</span><strong>{data.summary.critical || 0}</strong><small>Sudah menyentuh buffer</small></div>
                </article>
                <article>
                    <div className="metric-icon stock-restock-icon"><TrendingUp /></div>
                    <div><span>Perlu restock</span><strong>{data.summary.restock || 0}</strong><small>Di bawah stok barrier</small></div>
                </article>
            </section>
            <div className="stock-status-guide">
                <div><span className="stock-health safe" /> <strong>Aman</strong><small>Stok di atas barrier</small></div>
                <div><span className="stock-health restock" /> <strong>Perlu Restock</strong><small>Stok mencapai barrier</small></div>
                <div><span className="stock-health critical" /> <strong>Kritis</strong><small>Stok mencapai buffer darurat</small></div>
                <p>Saldo diperbarui otomatis dari penerimaan, resep, waste, transfer, dan opname.</p>
            </div>
            <section className="card data-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Saldo Stok per Gudang</h2>
                        <p>
                            Sumber audit utama tetap inventory movement ledger
                        </p>
                    </div>
                </div>
                <ListControls
                    view={listView}
                    placeholder="Cari SKU, produk, gudang, atau Store..."
                    extra={
                        <Select
                            className="stock-status-filter"
                            classNamePrefix="select2"
                            value={[
                                { value: "safe", label: "Aman" },
                                { value: "restock", label: "Perlu Restock" },
                                { value: "critical", label: "Kritis" },
                            ].find((option) => option.value === statusFilter) || null}
                            options={[
                                { value: "safe", label: "Aman" },
                                { value: "restock", label: "Perlu Restock" },
                                { value: "critical", label: "Kritis" },
                            ]}
                            onChange={(option) => setStatusFilter(option?.value || "")}
                            placeholder="Semua status"
                            isClearable
                        />
                    }
                />
                {listView.rows.length ? (
                    <div className="table-wrap">
                        <table className="professional-stock-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    {!store && <th>Store</th>}
                                    <th>Produk</th>
                                    <th>Bahan</th>
                                    <th>Status Master</th>
                                    <th>Gudang</th>
                                    <th>Stok tersedia</th>
                                    <th>Direservasi</th>
                                    <th>Barrier / Buffer</th>
                                    <th>Rata-rata modal</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listView.rows.map((r) => (
                                    <tr
                                        key={`${r.warehouse_id}-${r.product_id || r.material_id}`}
                                    >
                                        <td>{r.sku}</td>
                                        {!store && <td>{r.outlet_name}</td>}
                                        <td>{r.stock_type === "product" ? <div className="stock-item-name"><span><Package /></span><div><strong>{r.product_name}</strong><small>Produk jadi</small></div></div> : <span className="stock-empty-cell">—</span>}</td>
                                        <td>{r.stock_type === "material" ? <div className="stock-item-name material"><span><Boxes /></span><div><strong>{r.product_name}</strong><small>Bahan inventory</small></div></div> : <span className="stock-empty-cell">—</span>}</td>
                                        <td><span className={`master-status-badge ${r.item_is_active ? "active" : "inactive"}`}>{r.item_is_active ? "Aktif" : "Nonaktif"}</span></td>
                                        <td>{r.warehouse_name}</td>
                                        <td>
                                            <strong className="stock-quantity">{decimalQty(r.quantity_available ?? r.quantity_on_hand)}</strong>{" "}
                                            {r.unit_code}
                                        </td>
                                        <td>
                                            {decimalQty(r.quantity_reserved)}{" "}
                                            {r.unit_code}
                                        </td>
                                        <td>{r.stock_type === "material" ? <><strong>{decimalQty(r.stock_barrier)}</strong> / {decimalQty(r.buffer_stock)} {r.unit_code}</> : "-"}</td>
                                        <td>
                                            {rupiah(r.average_cost)}
                                        </td>
                                        <td><span className={`stock-status-badge ${r.stock_status}`}>{r.stock_status === "critical" ? "Kritis" : r.stock_status === "restock" ? "Perlu Restock" : "Aman"}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Package />
                        <h3>Belum ada saldo stok</h3>
                        <p>
                            Stok akan muncul setelah penerimaan barang pertama
                            diposting atau opening stock dibuat.
                        </p>
                        <a href="/purchase-orders">Buat order barang</a>
                    </div>
                )}
            </section>
        </div>
    );
}
