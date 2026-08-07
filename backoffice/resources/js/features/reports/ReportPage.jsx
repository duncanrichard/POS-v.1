import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CreditCard, Download, FileText, LoaderCircle, ReceiptText, ShoppingBag, Store, Users } from "lucide-react";
import { rupiah, useListView, ListControls } from "../../shared/ui";

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const labels = { cash: "Cash", qris: "QRIS", debit_card: "Kartu Debit", e_wallet: "E-Wallet", dine_in: "Dine In", take_away: "Take Away", delivery: "Delivery" };
const empty = { outlets: [], summary: {}, daily_sales: [], payments: [], order_types: [], top_products: [], cashiers: [], shifts: [], transactions: [] };
const dateTime = (value) => value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";

export function ReportPage() {
    const [filters, setFilters] = useState({ from: monthStart, until: today, outlet_id: "" });
    const [data, setData] = useState(empty);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const transactions = useListView(data.transactions || [], 15);
    const query = () => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    async function load() {
        setLoading(true); setError("");
        try {
            const response = await fetch(`/api/reports?${query()}`, { headers: { Accept: "application/json" } });
            const body = await response.json();
            if (!response.ok) throw new Error(Object.values(body.errors || {})[0]?.[0] || body.message || "Laporan gagal dimuat.");
            setData(body);
        } catch (problem) { setError(problem.message); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);
    const maxDaily = Math.max(1, ...data.daily_sales.map((item) => Number(item.total)));
    const summary = data.summary || {};
    const metrics = [
        ["Penjualan bersih", rupiah(summary.net_sales), BarChart3, "Nilai transaksi berstatus lunas"],
        ["Total pesanan", Number(summary.transaction_count || 0).toLocaleString("id-ID"), ShoppingBag, `${Number(summary.items_sold || 0).toLocaleString("id-ID")} item terjual`],
        ["Rata-rata transaksi", rupiah(summary.average_order), ReceiptText, `${summary.open_bills || 0} open bill`],
        ["Total diskon", rupiah(summary.discount_total), FileText, `Pajak ${rupiah(summary.tax_total)}`],
    ];
    const paymentTotal = data.payments.reduce((sum, item) => sum + Number(item.total), 0);
    const selectedOutlet = data.outlets.find((outlet) => outlet.id === filters.outlet_id)?.name || "Semua outlet";
    const exportReport = () => { window.location.href = `/api/reports/export?${query()}&report_type=transactions`; };

    return <div className="content module-content report-page">
        <section className="module-hero report-hero"><div><p className="eyebrow">BACKOFFICE / LAPORAN</p><h1>Laporan Penjualan F&B</h1><p>Analisis transaksi POS, metode pembayaran, jenis pesanan, produk, kasir, dan shift berdasarkan data aktual.</p></div><button className="primary-action" onClick={exportReport}><Download/> Export Excel</button></section>
        <section className="card report-filters"><label><span><CalendarDays/> Dari tanggal</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })}/></label><label><span><CalendarDays/> Sampai tanggal</span><input type="date" value={filters.until} onChange={(e) => setFilters({ ...filters, until: e.target.value })}/></label><label><span><Store/> Outlet</span><select value={filters.outlet_id} onChange={(e) => setFilters({ ...filters, outlet_id: e.target.value })}><option value="">Semua outlet</option>{data.outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.code} — {outlet.name}</option>)}</select></label><button onClick={load} disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <BarChart3/>}{loading ? "Menghitung..." : "Tampilkan Laporan"}</button></section>
        {error && <div className="report-error">{error}</div>}
        {!loading && !data.data_status?.has_server_transactions && <div className="report-source-warning"><b>Belum ada transaksi server</b><span>{data.data_status?.message}</span><small>Lakukan satu transaksi baru sampai pembayaran berhasil di POS, lalu refresh laporan.</small></div>}
        <div className="report-period"><b>{selectedOutlet}</b><span>{filters.from} sampai {filters.until}</span></div>
        <section className="module-stats report-stats">{metrics.map(([label, value, Icon, note], index) => <article key={label}><div className={`metric-icon icon-${index}`}><Icon/></div><div><span>{label}</span><strong>{loading ? "..." : value}</strong><small>{note}</small></div></article>)}</section>

        <section className="report-grid two"><article className="card report-card sales-trend"><header><div><h2>Tren Penjualan Harian</h2><p>Total transaksi lunas per hari</p></div><b>{rupiah(summary.net_sales)}</b></header><div className="report-bars">{data.daily_sales.length ? data.daily_sales.map((item) => <div key={item.report_date}><span title={rupiah(item.total)} style={{ height: `${Math.max(5, Number(item.total) / maxDaily * 100)}%` }}/><small>{new Date(`${item.report_date}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</small></div>) : <div className="report-empty">Belum ada penjualan pada periode ini.</div>}</div></article>
        <article className="card report-card"><header><div><h2>Metode Pembayaran</h2><p>Rekonsiliasi penerimaan pembayaran</p></div><CreditCard/></header><div className="report-breakdown">{data.payments.map((item) => <div key={item.method}><span><i style={{ width: `${paymentTotal ? Number(item.total) / paymentTotal * 100 : 0}%` }}/><b>{labels[item.method] || item.method}</b><small>{item.transaction_count} transaksi</small></span><strong>{rupiah(item.total)}</strong></div>)}{!data.payments.length && <p className="report-empty">Belum ada pembayaran.</p>}<footer><span>Total seluruh pembayaran</span><b>{rupiah(paymentTotal)}</b></footer></div></article></section>

        <section className="report-grid three"><article className="card report-card"><header><div><h2>Jenis Pesanan</h2><p>Dine In, Take Away, Delivery</p></div><ShoppingBag/></header><div className="mini-table">{data.order_types.map((item) => <div key={item.order_type}><span><b>{labels[item.order_type] || item.order_type}</b><small>{item.transaction_count} pesanan</small></span><strong>{rupiah(item.total)}</strong></div>)}{!data.order_types.length && <p className="report-empty">Belum ada data.</p>}</div></article>
        <article className="card report-card"><header><div><h2>Produk Terlaris</h2><p>Berdasarkan kuantitas terjual</p></div><ReceiptText/></header><div className="mini-table ranked">{data.top_products.slice(0, 8).map((item, index) => <div key={item.product_name}><em>{index + 1}</em><span><b>{item.product_name}</b><small>{Number(item.quantity).toLocaleString("id-ID")} terjual</small></span><strong>{rupiah(item.total)}</strong></div>)}{!data.top_products.length && <p className="report-empty">Belum ada data.</p>}</div></article>
        <article className="card report-card"><header><div><h2>Performa Kasir</h2><p>Transaksi per operator</p></div><Users/></header><div className="mini-table">{data.cashiers.slice(0, 8).map((item) => <div key={item.cashier_name}><span><b>{item.cashier_name}</b><small>{item.transaction_count} transaksi</small></span><strong>{rupiah(item.total)}</strong></div>)}{!data.cashiers.length && <p className="report-empty">Belum ada data.</p>}</div></article></section>

        <section className="card data-card report-transactions"><div className="data-toolbar"><div><h2>Detail Transaksi</h2><p>{data.transactions.length} transaksi ditemukan, maksimal 500 data terbaru</p></div><button onClick={exportReport}><Download/> Ekspor semua</button></div><ListControls view={transactions} placeholder="Cari nomor order, outlet, kasir..."/>
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Waktu</th><th>Outlet / Kasir</th><th>Jenis</th><th>Pembayaran</th><th>Subtotal</th><th>Diskon</th><th>Pajak</th><th>Total</th><th>Status</th></tr></thead><tbody>{transactions.rows.map((row) => <tr key={row.id}><td><b>#{row.order_number}</b></td><td>{dateTime(row.ordered_at)}</td><td><b>{row.outlet_name}</b><small>{row.cashier_name || "-"}</small></td><td>{labels[row.order_type] || row.order_type}</td><td>{labels[row.payment_method] || row.payment_method || "-"}</td><td>{rupiah(row.subtotal)}</td><td>{rupiah(row.discount_total)}</td><td>{rupiah(row.tax_total)}</td><td><b>{rupiah(row.grand_total)}</b></td><td><span className={`status ${row.payment_status === "paid" ? "active" : "warning"}`}>{row.payment_status === "paid" ? "Lunas" : "Belum lunas"}</span></td></tr>)}</tbody></table></div>{!transactions.rows.length && <div className="report-empty table">Belum ada transaksi pada periode ini.</div>}</section>
    </div>;
}

const detailConfig = {
    outlet_daily: { title: "Omzet Cabang Harian", description: "Perbandingan omzet setiap cabang untuk setiap tanggal operasional.", source: "outlet_daily", headers: ["Tanggal", "Cabang", "Transaksi", "Subtotal", "Diskon", "Pajak", "Omzet"], row: (x) => [x.report_date, `${x.outlet_code} — ${x.outlet_name}`, x.transaction_count, rupiah(x.subtotal), rupiah(x.discount_total), rupiah(x.tax_total), rupiah(x.total)] },
    staff: { title: "Penjualan per Staff", description: "Produktivitas dan nilai transaksi setiap kasir/staff.", source: "cashiers", headers: ["Staff", "Jumlah Transaksi", "Total Penjualan", "Rata-rata"], row: (x) => [x.cashier_name, x.transaction_count, rupiah(x.total), rupiah(Number(x.total) / Math.max(1, Number(x.transaction_count)))] },
    payments: { title: "Metode Pembayaran", description: "Rekonsiliasi Cash, QRIS, Debit, dan E-Wallet.", source: "payments", headers: ["Metode", "Jumlah Transaksi", "Total Pembayaran", "Kontribusi"], row: (x, data) => [labels[x.method] || x.method, x.transaction_count, rupiah(x.total), `${(Number(x.total) / Math.max(1, data.reduce((s, y) => s + Number(y.total), 0)) * 100).toFixed(1)}%`] },
    products: { title: "Laporan Produk Terlaris", description: "Kuantitas produk terjual dan kontribusi omzet menu.", source: "top_products", headers: ["Produk", "Jumlah Terjual", "Omzet", "Rata-rata Harga"], row: (x) => [x.product_name, Number(x.quantity).toLocaleString("id-ID"), rupiah(x.total), rupiah(Number(x.total) / Math.max(1, Number(x.quantity)))] },
    shifts: { title: "Laporan Shift Kasir", description: "Riwayat buka-tutup kasir berdasarkan outlet dan register.", source: "shifts", headers: ["Nomor Shift", "Outlet", "Register", "Kasir", "Dibuka", "Ditutup", "Modal Awal", "Kas Sistem", "Status"], row: (x) => [x.shift_number, x.outlet_name, `${x.register_code} — ${x.register_name}`, x.cashier_name, dateTime(x.opened_at), dateTime(x.closed_at), rupiah(x.opening_cash), rupiah(x.expected_cash), x.status === "closed" ? "Ditutup" : "Aktif"] },
};

export function ReportDetailPage({ reportType }) {
    const config = detailConfig[reportType];
    const [filters, setFilters] = useState({ from: monthStart, until: today, outlet_id: "" });
    const [data, setData] = useState(empty); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const rows = data[config.source] || []; const view = useListView(rows, 20);
    const query = () => new URLSearchParams({ ...filters, report_type: reportType }).toString();
    async function load() { setLoading(true); setError(""); try { const response = await fetch(`/api/reports?${query()}`, { headers: { Accept: "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(Object.values(body.errors || {})[0]?.[0] || body.message || "Laporan gagal dimuat."); setData(body); } catch (problem) { setError(problem.message); } finally { setLoading(false); } }
    useEffect(() => { load(); }, [reportType]);
    return <div className="content module-content report-page"><section className="module-hero report-hero"><div><p className="eyebrow">LAPORAN / {config.title.toUpperCase()}</p><h1>{config.title}</h1><p>{config.description}</p></div><button className="primary-action" onClick={() => { window.location.href = `/api/reports/export?${query()}`; }}><Download/> Export Excel</button></section>
        <section className="card report-filters"><label><span><CalendarDays/> Dari tanggal</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })}/></label><label><span><CalendarDays/> Sampai tanggal</span><input type="date" value={filters.until} onChange={(e) => setFilters({ ...filters, until: e.target.value })}/></label><label><span><Store/> Outlet</span><select value={filters.outlet_id} onChange={(e) => setFilters({ ...filters, outlet_id: e.target.value })}><option value="">Semua outlet</option>{data.outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.code} — {outlet.name}</option>)}</select></label><button onClick={load} disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <BarChart3/>}{loading ? "Menghitung..." : "Tampilkan"}</button></section>
        {error && <div className="report-error">{error}</div>}<section className="card data-card report-transactions detail-report"><div className="data-toolbar"><div><h2>{config.title}</h2><p>{rows.length} baris laporan ditemukan</p></div><button onClick={() => { window.location.href = `/api/reports/export?${query()}`; }}><Download/> Excel</button></div><ListControls view={view} placeholder={`Cari ${config.title.toLowerCase()}...`}/><div className="table-wrap"><table><thead><tr>{config.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{view.rows.map((item, index) => <tr key={item.id || item.shift_number || item.report_date + item.outlet_code || index}>{config.row(item, rows).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>{!view.rows.length && <div className="report-empty table">Belum ada data pada periode ini.</div>}</section>
    </div>;
}
