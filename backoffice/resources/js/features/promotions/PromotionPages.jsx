import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { BadgePercent, Boxes, CalendarDays, CheckCircle2, PackagePlus, Plus, Trash2 } from "lucide-react";
import { csrf, ListControls, rupiah, useListView } from "../../shared/ui";

const request = async (url, options = {}) => {
    const response = await fetch(url, { headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-TOKEN": csrf(), ...(options.headers || {}) }, ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(Object.values(body.errors || {})?.[0]?.[0] || body.message || "Data gagal diproses.");
    return body;
};
const statusPeriod = (row) => {
    const today = new Date().toISOString().slice(0, 10);
    return today < row.effective_from ? ["soon", "Akan Datang"] : today > row.effective_until ? ["expired", "Berakhir"] : ["active", "Aktif"];
};

export function PromotionMasterPage() {
    const [rows, setRows] = useState([]); const [editing, setEditing] = useState(null); const [error, setError] = useState(""); const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ name: "", discount_type: "percentage", discount_value: "", effective_from: "", effective_until: "", is_active: true });
    const view = useListView(rows);
    const load = () => fetch("/api/promotions").then((r) => r.json()).then(setRows);
    useEffect(() => { void load(); }, []);
    const reset = () => { setEditing(null); setModal(false); setForm({ name: "", discount_type: "percentage", discount_value: "", effective_from: "", effective_until: "", is_active: true }); setError(""); };
    const submit = async (event) => { event.preventDefault(); setError(""); try { await request(editing ? `/api/promotions/${editing.id}` : "/api/promotions", { method: editing ? "PUT" : "POST", body: JSON.stringify(form) }); reset(); load(); } catch (e) { setError(e.message); } };
    const edit = (row) => { setEditing(row); setModal(true); setError(""); setForm({ name: row.name, discount_type: row.discount_type, discount_value: Number(row.discount_value), effective_from: row.effective_from, effective_until: row.effective_until, is_active: !!row.is_active }); };
    const remove = async (row) => { if (!confirm(`Hapus promo ${row.name}?`)) return; try { await request(`/api/promotions/${row.id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); } };
    return <Page title="Master Promo" eyebrow="MASTER DATA / PROMO" description="Kelola nama promo, nilai diskon, dan periode berlakunya.">
        <div className="master-promo-actions"><a href="/master-data">Kembali ke Master Data</a><button className="primary-action" onClick={()=>{reset();setModal(true);}}><Plus/>Tambah Promo</button></div>
        {error && !modal && <div className="form-alert">{error}</div>}
        <DataTable title="Daftar Master Promo" view={view} placeholder="Cari kode atau nama promo..." headers={["Kode","Nama Promo","Diskon","Periode","Status","Aksi"]}>{view.rows.map((row)=>{const status=statusPeriod(row); return <tr key={row.id}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.discount_type==="percentage"?`${Number(row.discount_value)}%`:rupiah(row.discount_value)}</td><td>{row.effective_from} — {row.effective_until}</td><td><span className={`price-status ${status[0]}`}>{status[1]}</span></td><td><div className="row-actions"><button onClick={()=>edit(row)}>Edit</button><button className="danger" onClick={()=>remove(row)}>Hapus</button></div></td></tr>})}</DataTable>
        {modal && <div className="modal-backdrop"><div className="form-modal promotion-modal"><button className="modal-close" onClick={reset}>×</button><div className="promotion-editor-head"><BadgePercent/><div><h2>{editing ? "Edit Master Promo" : "Tambah Master Promo"}</h2><p>Kode promo dibuat otomatis oleh sistem.</p></div></div>{error && <div className="form-alert">{error}</div>}<form onSubmit={submit} className="promotion-modal-form"><label>Nama promo<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required placeholder="Contoh: Diskon Kemerdekaan"/></label><div className="promotion-modal-grid"><label>Jenis diskon<select value={form.discount_type} onChange={(e)=>setForm({...form,discount_type:e.target.value})}><option value="percentage">Persentase (%)</option><option value="fixed">Nominal (Rp)</option></select></label><label>Nilai diskon<input type="number" min="0.01" step="0.01" value={form.discount_value} onChange={(e)=>setForm({...form,discount_value:e.target.value})} required/></label><label>Tanggal mulai<input type="date" value={form.effective_from} onChange={(e)=>setForm({...form,effective_from:e.target.value})} required/></label><label>Tanggal berakhir<input type="date" value={form.effective_until} onChange={(e)=>setForm({...form,effective_until:e.target.value})} required/></label></div><label className="switch-field"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})}/> Promo aktif</label><button className="primary-action promotion-modal-submit"><CheckCircle2/>{editing ? "Simpan Perubahan" : "Simpan Promo"}</button></form></div></div>}
    </Page>;
}

function LegacyProductPromotionPage() {
    const [options,setOptions]=useState({products:[],promotions:[]}); const [rows,setRows]=useState([]); const [productId,setProductId]=useState(""); const [promotionId,setPromotionId]=useState(""); const [error,setError]=useState(""); const [modal,setModal]=useState(false); const [editing,setEditing]=useState(null);
    const view=useListView(rows); const load=()=>Promise.all([fetch("/api/promotion-options").then(r=>r.json()),fetch("/api/product-promotions").then(r=>r.json())]).then(([o,x])=>{setOptions(o);setRows(x);}); useEffect(()=>{void load();},[]);
    const product=options.products.find(x=>x.id===productId); const availablePromotions=options.promotions.filter(promotion=>!rows.some(row=>row.id!==editing?.id&&row.product_id===productId&&row.promotion_id===promotion.id)); const promo=availablePromotions.find(x=>x.id===promotionId); const promoPrice=useMemo(()=>{if(!product||!promo)return 0;const price=Number(product.selling_price);return Math.max(0,promo.discount_type==="percentage"?price*(1-Number(promo.discount_value)/100):price-Number(promo.discount_value));},[product,promo]);
    const close=()=>{setModal(false);setEditing(null);setProductId("");setPromotionId("");setError("");};
    const openEdit=row=>{setEditing(row);setProductId(row.product_id);setPromotionId(row.promotion_id);setError("");setModal(true);};
    const submit=async(e)=>{e.preventDefault();setError("");try{await request(editing?`/api/product-promotions/${editing.id}`:"/api/product-promotions",{method:editing?"PUT":"POST",body:JSON.stringify({product_id:productId,promotion_id:promotionId})});close();load();}catch(x){setError(x.message);}};
    const remove=async(id)=>{if(!confirm("Hapus promo dari produk ini?"))return;await request(`/api/product-promotions/${id}`,{method:"DELETE"});load();};
    return <Page title="Produk Promo" eyebrow="PROMO / PRODUK" description="Pilih produk dan master promo. Harga promo dihitung otomatis."><div className="page-primary-actions"><button className="primary-action" onClick={()=>{close();setModal(true);}}><Plus/>Tambah Produk Promo</button></div><DataTable title="Daftar Produk Promo" view={view} placeholder="Cari produk atau promo..." headers={["Produk","Promo","Harga Normal","Harga Promo","Periode","Aksi"]}>{view.rows.map(row=><tr key={row.id}><td><strong>{row.product_name}</strong><small className="cell-subtitle">{row.sku}</small></td><td>{row.promotion_name}</td><td>{rupiah(row.original_price)}</td><td><strong className="promo-price-text">{rupiah(row.promo_price)}</strong></td><td>{row.effective_from} — {row.effective_until}</td><td><div className="row-actions"><button onClick={()=>openEdit(row)}>Edit</button><button className="danger" onClick={()=>remove(row.id)}>Hapus</button></div></td></tr>)}</DataTable>{modal&&<div className="modal-backdrop"><div className="form-modal product-promo-modal"><button className="modal-close" onClick={close}>×</button><div className="builder-title"><BadgePercent/><div><h2>{editing?"Edit Produk Promo":"Tambah Produk Promo"}</h2><p>Harga promo dan periode dihitung otomatis.</p></div></div>{error&&<div className="form-alert">{error}</div>}<form onSubmit={submit}><div className="promo-select-grid"><label>Produk<Select classNamePrefix="select2" options={options.products.map(x=>({value:x.id,label:`${x.sku} - ${x.name}`}))} value={options.products.map(x=>({value:x.id,label:`${x.sku} - ${x.name}`})).find(x=>x.value===productId)||null} onChange={x=>{setProductId(x?.value||"");setPromotionId("");}} placeholder="Cari produk..."/></label><label>Master Promo<Select classNamePrefix="select2" options={availablePromotions.map(x=>({value:x.id,label:`${x.code} - ${x.name}`}))} value={availablePromotions.map(x=>({value:x.id,label:`${x.code} - ${x.name}`})).find(x=>x.value===promotionId)||null} onChange={x=>setPromotionId(x?.value||"")} placeholder={productId?"Cari promo aktif...":"Pilih produk terlebih dahulu"} isDisabled={!productId}/></label></div><div className="promo-price-preview"><div><small>Harga normal</small><strong>{rupiah(product?.selling_price||0)}</strong></div><i>→</i><div className="highlight"><small>Harga setelah promo</small><strong>{rupiah(promoPrice)}</strong></div><div><small>Periode promo</small><strong>{promo?`${promo.effective_from} — ${promo.effective_until}`:"-"}</strong></div></div><button className="primary-action product-promo-submit" disabled={!product||!promo}><CheckCircle2/>{editing?"Simpan Perubahan":"Simpan Produk Promo"}</button></form></div></div>}</Page>;
}

export function ProductPromotionPage() {
    const [options, setOptions] = useState({ products: [], bundles: [], promotions: [] });
    const [rows, setRows] = useState([]);
    const [targetType, setTargetType] = useState("product");
    const [targetKey, setTargetKey] = useState("");
    const [promotionId, setPromotionId] = useState("");
    const [error, setError] = useState("");
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [typeFilter, setTypeFilter] = useState("all");
    const filteredRows = typeFilter === "all" ? rows : rows.filter(row => row.target_type === typeFilter);
    const view = useListView(filteredRows);
    const load = () => Promise.all([fetch("/api/promotion-options").then(response => response.json()), fetch("/api/product-promotions").then(response => response.json())])
        .then(([available, promotions]) => { setOptions(available); setRows(promotions); });
    useEffect(() => { void load(); }, []);

    const targets = (targetType === "bundle" ? options.bundles || [] : options.products || [])
        .map(item => ({ ...item, type: targetType, key: `${targetType}:${item.id}` }));
    const target = targets.find(item => item.key === targetKey);
    const availablePromotions = options.promotions.filter(promotion => !rows.some(row => row.id !== editing?.id && row.target_type === target?.type && (row.product_id || row.product_bundle_id) === target?.id && row.promotion_id === promotion.id));
    const promo = availablePromotions.find(item => item.id === promotionId);
    const promoPrice = useMemo(() => {
        if (!target || !promo) return 0;
        const price = Number(target.selling_price);
        return Math.max(0, promo.discount_type === "percentage" ? price * (1 - Number(promo.discount_value) / 100) : price - Number(promo.discount_value));
    }, [target, promo]);
    const chooseTargetType = type => { setTargetType(type); setTargetKey(""); setPromotionId(""); };
    const close = () => { setModal(false); setEditing(null); setTargetType("product"); setTargetKey(""); setPromotionId(""); setError(""); };
    const openEdit = row => {
        setEditing(row);
        setTargetType(row.target_type);
        setTargetKey(`${row.target_type}:${row.product_id || row.product_bundle_id}`);
        setPromotionId(row.promotion_id);
        setError("");
        setModal(true);
    };
    const submit = async event => {
        event.preventDefault();
        setError("");
        try {
            await request(editing ? `/api/product-promotions/${editing.id}` : "/api/product-promotions", {
                method: editing ? "PUT" : "POST",
                body: JSON.stringify({ target_type: target.type, target_id: target.id, promotion_id: promotionId }),
            });
            close();
            load();
        } catch (exception) { setError(exception.message); }
    };
    const remove = async id => {
        if (!confirm("Hapus promo dari produk ini?")) return;
        await request(`/api/product-promotions/${id}`, { method: "DELETE" });
        load();
    };

    return <Page title="Produk Promo" eyebrow="PROMO / PRODUK & BUNDLING" description="Pasangkan promo aktif ke produk biasa maupun produk bundling.">
        <div className="promo-page-actions"><div className="promo-type-filter"><span>Filter jenis</span><Select classNamePrefix="select2" isSearchable={false} options={[{ value: "all", label: "Semua Jenis" }, { value: "product", label: "Ala Carte" }, { value: "bundle", label: "Bundling" }]} value={[{ value: "all", label: "Semua Jenis" }, { value: "product", label: "Ala Carte" }, { value: "bundle", label: "Bundling" }].find(item => item.value === typeFilter)} onChange={item => setTypeFilter(item?.value || "all")} /></div><button className="primary-action" onClick={() => { close(); setModal(true); }}><Plus />Tambah Produk Promo</button></div>
        <DataTable title="Daftar Produk Promo" view={view} placeholder="Cari produk, bundling, atau promo..." headers={["Target Promo", "Jenis", "Promo", "Harga Normal", "Harga Promo", "Periode", "Aksi"]}>
            {view.rows.map(row => <tr key={row.id}><td><strong>{row.product_name}</strong><small className="cell-subtitle">{row.sku}</small></td><td><span className={`promo-target-badge ${row.target_type}`}>{row.target_type === "bundle" ? "Bundling" : "Ala Carte"}</span></td><td>{row.promotion_name}</td><td>{rupiah(row.original_price)}</td><td><strong className="promo-price-text">{rupiah(row.promo_price)}</strong></td><td>{row.effective_from} — {row.effective_until}</td><td><div className="row-actions"><button onClick={() => openEdit(row)}>Edit</button><button className="danger" onClick={() => remove(row.id)}>Hapus</button></div></td></tr>)}
        </DataTable>
        {modal && <div className="modal-backdrop"><div className="form-modal product-promo-modal">
            <button className="modal-close" onClick={close}>×</button>
            <div className="builder-title"><BadgePercent /><div><h2>{editing ? "Edit Produk Promo" : "Tambah Produk Promo"}</h2><p>Pilih jenis penjualan, item, lalu promo aktif.</p></div></div>
            {error && <div className="form-alert">{error}</div>}
            <form onSubmit={submit}>
                <div className="promo-target-type"><span>Jenis produk</span><div className="promo-type-options"><button type="button" className={targetType === "product" ? "active" : ""} onClick={() => chooseTargetType("product")}><strong>Ala Carte</strong><small>Produk satuan</small></button><button type="button" className={targetType === "bundle" ? "active" : ""} onClick={() => chooseTargetType("bundle")}><strong>Bundling</strong><small>Paket beberapa produk</small></button></div></div>
                <div className="promo-select-grid"><label>{targetType === "bundle" ? "Produk Bundling" : "Produk Ala Carte"}<Select classNamePrefix="select2" options={targets.map(item => ({ value: item.key, label: `${item.name} (${rupiah(item.selling_price)})` }))} value={targets.map(item => ({ value: item.key, label: `${item.name} (${rupiah(item.selling_price)})` })).find(item => item.value === targetKey) || null} onChange={item => { setTargetKey(item?.value || ""); setPromotionId(""); }} placeholder={targetType === "bundle" ? "Cari produk bundling..." : "Cari produk ala carte..."} /></label><label>Master Promo<Select classNamePrefix="select2" options={availablePromotions.map(item => ({ value: item.id, label: `${item.code} - ${item.name}` }))} value={availablePromotions.map(item => ({ value: item.id, label: `${item.code} - ${item.name}` })).find(item => item.value === promotionId) || null} onChange={item => setPromotionId(item?.value || "")} placeholder={target ? "Cari promo aktif..." : "Pilih produk terlebih dahulu"} isDisabled={!target} /></label></div>
                <div className="promo-price-preview"><div><small>Harga normal</small><strong>{rupiah(target?.selling_price || 0)}</strong></div><i>→</i><div className="highlight"><small>Harga setelah promo</small><strong>{rupiah(promoPrice)}</strong></div><div><small>Periode promo</small><strong>{promo ? `${promo.effective_from} — ${promo.effective_until}` : "-"}</strong></div></div>
                <button className="primary-action product-promo-submit" disabled={!target || !promo}><CheckCircle2 />{editing ? "Simpan Perubahan" : "Simpan Produk Promo"}</button>
            </form>
        </div></div>}
    </Page>;
}

function LegacyProductBundlePage() {
    const [products,setProducts]=useState([]); const [rows,setRows]=useState([]); const [error,setError]=useState(""); const [form,setForm]=useState({name:"",selling_price:"",effective_from:"",effective_until:"",items:[{product_id:"",quantity:1},{product_id:"",quantity:1}]}); const view=useListView(rows);
    const load=()=>Promise.all([fetch("/api/promotion-options").then(r=>r.json()),fetch("/api/product-bundles").then(r=>r.json())]).then(([o,x])=>{setProducts(o.products||[]);setRows(x);});useEffect(()=>{void load();},[]); const normalTotal=form.items.reduce((sum,item)=>sum+Number(products.find(x=>x.id===item.product_id)?.selling_price||0)*Number(item.quantity||0),0);
    const updateItem=(i,key,value)=>setForm({...form,items:form.items.map((x,n)=>n===i?{...x,[key]:value}:x)}); const submit=async(e)=>{e.preventDefault();setError("");try{await request("/api/product-bundles",{method:"POST",body:JSON.stringify(form)});setForm({name:"",selling_price:"",effective_from:"",effective_until:"",items:[{product_id:"",quantity:1},{product_id:"",quantity:1}]});load();}catch(x){setError(x.message);}}; const remove=async id=>{if(!confirm("Hapus bundling ini?"))return;await request(`/api/product-bundles/${id}`,{method:"DELETE"});load();};
    return <Page title="Produk Bundling" eyebrow="PROMO / BUNDLING" description="Gabungkan beberapa produk menjadi satu SKU dan satu harga bundling."><section className="card bundle-builder"><div className="builder-title"><PackagePlus/><div><h2>Buat Bundling Baru</h2><p>SKU bundling dibuat otomatis oleh backend.</p></div></div>{error&&<div className="form-alert">{error}</div>}<form onSubmit={submit}><div className="bundle-main-fields"><label>Nama bundling<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Contoh: Paket Burger Hemat"/></label><label>Harga bundling<input type="number" min="1" value={form.selling_price} onChange={e=>setForm({...form,selling_price:e.target.value})} required/></label><label>Mulai<input type="date" value={form.effective_from} onChange={e=>setForm({...form,effective_from:e.target.value})} required/></label><label>Berakhir<input type="date" value={form.effective_until} onChange={e=>setForm({...form,effective_until:e.target.value})} required/></label></div><div className="bundle-items-head"><strong>Produk dalam bundling</strong><button type="button" onClick={()=>setForm({...form,items:[...form.items,{product_id:"",quantity:1}]})}><Plus/>Tambah produk</button></div>{form.items.map((item,i)=><div className="bundle-item-row" key={i}><Select classNamePrefix="select2" options={products.map(x=>({value:x.id,label:`${x.sku} - ${x.name} (${rupiah(x.selling_price)})`}))} value={products.map(x=>({value:x.id,label:`${x.sku} - ${x.name} (${rupiah(x.selling_price)})`})).find(x=>x.value===item.product_id)||null} onChange={x=>updateItem(i,"product_id",x?.value||"")} placeholder="Cari produk..."/><input type="number" min="1" step="0.0001" value={item.quantity} onChange={e=>updateItem(i,"quantity",e.target.value)}/><button type="button" disabled={form.items.length<=2} onClick={()=>setForm({...form,items:form.items.filter((_,n)=>n!==i)})}><Trash2/></button></div>)}<div className="bundle-total"><span>Total harga normal <strong>{rupiah(normalTotal)}</strong></span><span>Harga bundling <strong>{rupiah(form.selling_price||0)}</strong></span><span>Hemat <strong>{rupiah(Math.max(0,normalTotal-Number(form.selling_price||0)))}</strong></span></div><button className="primary-action"><CheckCircle2/>Simpan Produk Bundling</button></form></section><DataTable title="Daftar Produk Bundling" view={view} placeholder="Cari SKU atau nama bundling..." headers={["SKU Bundling","Nama","Isi Produk","Harga","Periode","Aksi"]}>{view.rows.map(row=><tr key={row.id}><td><strong>{row.sku}</strong></td><td>{row.name}</td><td>{row.items.map(x=>`${x.product_name} × ${Number(x.quantity)}`).join(", ")}</td><td>{rupiah(row.selling_price)}</td><td>{row.effective_from} — {row.effective_until}</td><td><button className="table-action danger" onClick={()=>remove(row.id)}>Hapus</button></td></tr>)}</DataTable></Page>;
}

export function ProductBundlePage() {
    const emptyForm = () => ({ name: "", selling_price: "", effective_from: "", effective_until: "", items: [{ product_id: "", quantity: 1 }, { product_id: "", quantity: 1 }] });
    const [products, setProducts] = useState([]);
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(null);
    const [modal, setModal] = useState(false);
    const [error, setError] = useState("");
    const view = useListView(rows);
    const load = () => Promise.all([fetch("/api/promotion-options").then(r => r.json()), fetch("/api/product-bundles").then(r => r.json())])
        .then(([options, bundles]) => { setProducts(options.products || []); setRows(bundles); });
    useEffect(() => { void load(); }, []);

    const normalTotal = form.items.reduce((sum, item) => sum + Number(products.find(product => product.id === item.product_id)?.selling_price || 0) * Number(item.quantity || 0), 0);
    const close = () => { setModal(false); setEditing(null); setForm(emptyForm()); setError(""); };
    const openCreate = () => { close(); setModal(true); };
    const openEdit = row => {
        setEditing(row);
        setError("");
        setForm({
            name: row.name,
            selling_price: Number(row.selling_price),
            effective_from: row.effective_from,
            effective_until: row.effective_until,
            items: row.items.map(item => ({ product_id: item.product_id, quantity: Number(item.quantity) })),
        });
        setModal(true);
    };
    const updateItem = (index, key, value) => setForm(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
    const submit = async event => {
        event.preventDefault();
        setError("");
        try {
            await request(editing ? `/api/product-bundles/${editing.id}` : "/api/product-bundles", {
                method: editing ? "PUT" : "POST",
                body: JSON.stringify(form),
            });
            close();
            load();
        } catch (exception) { setError(exception.message); }
    };
    const remove = async id => {
        if (!confirm("Hapus produk bundling ini?")) return;
        await request(`/api/product-bundles/${id}`, { method: "DELETE" });
        load();
    };

    return <Page title="Produk Bundling" eyebrow="PROMO / BUNDLING" description="Gabungkan beberapa produk menjadi satu paket, periode, dan harga bundling.">
        <div className="page-primary-actions"><button className="primary-action" onClick={openCreate}><Plus />Tambah Produk Bundling</button></div>
        <DataTable title="Daftar Produk Bundling" view={view} placeholder="Cari SKU atau nama bundling..." headers={["SKU Bundling", "Nama", "Isi Produk", "Harga", "Periode", "Aksi"]}>
            {view.rows.map(row => <tr key={row.id}>
                <td><strong>{row.sku}</strong></td><td>{row.name}</td>
                <td>{row.items.map(item => `${item.product_name} × ${Number(item.quantity)}`).join(", ")}</td>
                <td><strong>{rupiah(row.selling_price)}</strong></td><td>{row.effective_from} — {row.effective_until || "Tanpa batas"}</td>
                <td><div className="row-actions"><button onClick={() => openEdit(row)}>Edit</button><button className="danger" onClick={() => remove(row.id)}>Hapus</button></div></td>
            </tr>)}
        </DataTable>
        {modal && <div className="modal-backdrop"><div className="form-modal product-bundle-modal">
            <button className="modal-close" onClick={close}>×</button>
            <div className="builder-title"><PackagePlus /><div><h2>{editing ? "Edit Produk Bundling" : "Tambah Produk Bundling"}</h2><p>SKU bundling dibuat otomatis oleh sistem.</p></div></div>
            {error && <div className="form-alert">{error}</div>}
            <form onSubmit={submit}>
                <div className="bundle-main-fields"><label>Nama bundling<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required placeholder="Contoh: Paket Burger Hemat" /></label><label>Harga bundling<input type="number" min="1" step="0.01" value={form.selling_price} onChange={event => setForm({ ...form, selling_price: event.target.value })} required /></label><label>Tanggal mulai<input type="date" value={form.effective_from} onChange={event => setForm({ ...form, effective_from: event.target.value })} required /></label><label>Tanggal berakhir <small>(opsional)</small><input type="date" value={form.effective_until || ""} onChange={event => setForm({ ...form, effective_until: event.target.value })} /><span className="field-help">Kosongkan jika bundling berlaku tanpa batas waktu.</span></label></div>
                <div className="bundle-items-head"><div><strong>Produk dalam bundling</strong><small>Minimal dua produk berbeda</small></div><button type="button" onClick={() => setForm({ ...form, items: [...form.items, { product_id: "", quantity: 1 }] })}><Plus />Tambah produk</button></div>
                <div className="bundle-items-list">{form.items.map((item, index) => <div className="bundle-item-row" key={index}><Select classNamePrefix="select2" options={products.filter(product => !form.items.some((selected, selectedIndex) => selectedIndex !== index && selected.product_id === product.id)).map(product => ({ value: product.id, label: `${product.name} (${rupiah(product.selling_price)})` }))} value={products.map(product => ({ value: product.id, label: `${product.name} (${rupiah(product.selling_price)})` })).find(option => option.value === item.product_id) || null} onChange={option => updateItem(index, "product_id", option?.value || "")} placeholder="Cari produk..." /><input aria-label="Jumlah produk" type="number" min="1" step="0.0001" value={item.quantity} onChange={event => updateItem(index, "quantity", event.target.value)} /><button type="button" aria-label="Hapus produk" disabled={form.items.length <= 2} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button></div>)}</div>
                <div className="bundle-total"><span>Total harga normal <strong>{rupiah(normalTotal)}</strong></span><span>Harga bundling <strong>{rupiah(form.selling_price || 0)}</strong></span><span>Hemat <strong>{rupiah(Math.max(0, normalTotal - Number(form.selling_price || 0)))}</strong></span></div>
                <button className="primary-action product-bundle-submit"><CheckCircle2 />{editing ? "Simpan Perubahan" : "Simpan Produk Bundling"}</button>
            </form>
        </div></div>}
    </Page>;
}

function Page({title,eyebrow,description,children}) { return <div className="content module-content promotion-page"><section className="module-hero"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></section>{children}</div>; }
function DataTable({title,view,placeholder,headers,children}) { return <section className="card data-card promotion-list"><div className="data-toolbar"><div><h2>{title}</h2><p>{view.total} data tersimpan</p></div></div><ListControls view={view} placeholder={placeholder}/>{view.rows.length?<div className="table-wrap"><table><thead><tr>{headers.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>:<div className="empty-state"><Boxes/><h3>Belum ada data</h3><p>Gunakan form di atas untuk membuat data pertama.</p></div>}</section>; }
