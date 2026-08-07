import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { QRCodeSVG } from "qrcode.react";
import {
    ShoppingBag,
    ChefHat,
    Package,
    Clock3,
    CircleDollarSign,
    AlertTriangle,
    X,
    Plus,
    CheckCircle2,
    ClipboardList,
    Boxes,
    ReceiptText,
    Trash2,
    BadgePercent,
} from "lucide-react";
import {
    csrf,
    decimalQty,
    ListControls,
    rupiah,
    useListView,
} from "../../shared/ui";

const masterResources = {
    positions: {
        label: "Jabatan",
        scope: "company",
        fields: [
            ["name", "Nama jabatan", "text"],
            ["description", "Deskripsi", "text"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    categories: {
        label: "Kategori Produk",
        scope: "outlet",
        fields: [
            ["name", "Nama kategori", "text"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    products: {
        label: "Produk",
        scope: "company",
        fields: [
            ["image", "Gambar produk", "image"],
            ["name", "Nama produk", "text"],
            ["category_id", "Kategori produk", "relation", "categories"],
            ["base_unit_id", "Satuan dasar", "relation", "units"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    "add-ons": {
        label: "Add-on Tambahan",
        scope: "company",
        fields: [
            ["name", "Nama add-on", "text"],
            ["price", "Harga tambahan", "number"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    "ingredient-modifiers": {
        label: "Modifier Ingredient",
        scope: "company",
        fields: [
            ["material_id", "Ingredient", "relation", "materials"],
            ["name", "Label di POS", "text"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    "material-categories": {
        label: "Kategori Bahan",
        scope: "company",
        fields: [
            ["name", "Nama kategori bahan", "text"],
            [
                "material_group",
                "Kelompok bahan",
                "select",
                ["raw", "packaging", "supporting"],
            ],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    materials: {
        label: "Bahan",
        scope: "company",
        fields: [
            ["name", "Nama bahan", "text"],
            [
                "material_category_id",
                "Kategori bahan",
                "relation",
                "materialCategories",
            ],
            ["base_unit_id", "Satuan dasar", "relation", "units"],
            ["buffer_stock", "Buffer stok", "number"],
            ["stock_barrier", "Stok barrier", "number"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    units: {
        label: "Satuan",
        scope: "global",
        fields: [
            ["name", "Nama satuan", "text"],
            [
                "unit_type",
                "Jenis satuan",
                "select",
                ["weight", "volume", "quantity"],
            ],
        ],
    },
    suppliers: {
        label: "Supplier",
        scope: "outlet",
        fields: [
            ["name", "Nama supplier", "text"],
            ["phone", "Telepon", "text"],
            ["email", "Email", "email"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    warehouses: {
        label: "Gudang",
        scope: "outlet",
        fields: [
            ["name", "Nama gudang", "text"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    stations: {
        label: "Kitchen Station",
        scope: "outlet",
        fields: [
            ["name", "Nama station", "text"],
            ["sla_minutes", "SLA (menit)", "number"],
            ["is_active", "Aktif", "boolean"],
        ],
    },
    tables: {
        label: "Meja",
        menuLabel: "Data Meja",
        scope: "outlet",
        fields: [
            ["table_number", "Nomor meja", "number"],
            ["name", "Nama meja", "text"],
            ["capacity", "Kapasitas", "number"],
            [
                "status",
                "Status",
                "select",
                ["available", "occupied", "inactive"],
            ],
        ],
    },
};
const masterResourceOrder = [
    "categories",
    "add-ons",
    "ingredient-modifiers",
    "material-categories",
    "units",
    "suppliers",
    "warehouses",
    "stations",
    "tables",
    "positions",
];

const tableStatusLabels = {
    available: "Tersedia",
    occupied: "Sedang Digunakan",
    inactive: "Nonaktif",
};

export function MasterDataPage({
    initialResource = "categories",
    productOnly = false,
}) {
    const [resource, setResource] = useState(initialResource);
    const [rows, setRows] = useState([]);
    const [stores, setStores] = useState([]);
    const [relations, setRelations] = useState({
        categories: [],
        materialCategories: [],
        materials: [],
        units: [],
    });
    const [productRecipes, setProductRecipes] = useState([]);
    const [store, setStore] = useState("");
    const [formStore, setFormStore] = useState("");
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingRows, setLoadingRows] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const config = masterResources[resource];
    const needsStore = config.scope === "outlet";
    const showStoreColumn = ["warehouses", "tables"].includes(resource);
    const categoryField =
        resource === "materials"
            ? "material_category_id"
            : resource === "products"
              ? "category_id"
              : null;
    const filteredRows = useMemo(
        () =>
            categoryField && categoryFilter
                ? rows.filter((row) => row[categoryField] === categoryFilter)
                : rows,
        [rows, categoryField, categoryFilter],
    );
    const listView = useListView(filteredRows);
    useEffect(() => setCategoryFilter(""), [resource]);
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
        const controller = new AbortController();
        const storeQuery = store ? `?outlet_id=${store}` : "";
        const requests = [];
        const relation = (url, key) =>
            requests.push(
                fetch(url, { signal: controller.signal })
                    .then((r) => r.json())
                    .then((data) =>
                        setRelations((current) => ({
                            ...current,
                            [key]: Array.isArray(data) ? data : [],
                        })),
                    ),
            );
        if (resource === "products") {
            relation("/api/master-data/units", "units");
            relation(`/api/master-data/categories${storeQuery}`, "categories");
            relation(`/api/master-data/materials${storeQuery}`, "materials");
            requests.push(
                fetch(`/api/recipes${storeQuery}`, {
                    signal: controller.signal,
                })
                    .then((r) => r.json())
                    .then((data) =>
                        setProductRecipes(Array.isArray(data) ? data : []),
                    ),
            );
        }
        if (resource === "materials") {
            relation("/api/master-data/units", "units");
            relation(
                `/api/master-data/material-categories${storeQuery}`,
                "materialCategories",
            );
        }
        if (resource === "ingredient-modifiers") {
            relation("/api/master-data/materials", "materials");
        }
        Promise.allSettled(requests);
        return () => controller.abort();
    }, [resource, store]);
    const load = () => {
        const controller = new AbortController();
        setLoadingRows(true);
        setLoadError("");
        fetch(
            `/api/master-data/${resource}${needsStore && store ? `?outlet_id=${store}` : ""}`,
            { signal: controller.signal },
        )
            .then(async (response) => {
                const body = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(
                        body.message ||
                            `Data gagal dimuat (HTTP ${response.status}).`,
                    );
                }
                return body;
            })
            .then((x) => setRows(Array.isArray(x) ? x : []))
            .catch((error) => {
                if (error.name !== "AbortError") {
                    setRows([]);
                    setLoadError(
                        error.message || "Data tidak dapat dimuat dari server.",
                    );
                }
            })
            .finally(() => setLoadingRows(false));
        return () => controller.abort();
    };
    useEffect(() => {
        void load();
    }, [resource, store]);
    function open(row = null) {
        setEditing(row);
        setFormStore(row?.outlet_id || store || "");
        const existingRecipe = row
            ? productRecipes.find((recipe) => recipe.product_id === row.id)
            : null;
        const values = {};
        config.fields.forEach(
            ([key, , type, options]) =>
                (values[key] =
                    row?.[key] ??
                    (type === "boolean"
                        ? true
                        : type === "select"
                          ? options[0]
                          : type === "relation"
                            ? ""
                            : "")),
        );
        if (resource === "products" && false) {
            values.ingredients = existingRecipe?.items?.map((item) => ({
                material_id: item.material_id,
                quantity: item.quantity,
                unit_id: item.unit_id,
            })) || [{ material_id: "", quantity: 1, unit_id: "" }];
            values.recipe_id = existingRecipe?.id || null;
        }
        if (resource === "products") {
            values.variants = ["S", "M", "L"].map((size) => {
                const variant = row?.variants?.find(
                    (item) => item.name === size,
                );
                return {
                    name: size,
                    is_active: variant?.is_active ?? true,
                };
            });
        }
        setForm(values);
        setError("");
        setModal(true);
    }
    async function submit(e) {
        e.preventDefault();
        if (saving) return;
        if (
            resource === "materials" &&
            Number(form.stock_barrier || 0) < Number(form.buffer_stock || 0)
        ) {
            setError("Stok barrier tidak boleh lebih kecil dari buffer stok.");
            return;
        }
        if (needsStore && !formStore) {
            setError("Pilih Store tujuan terlebih dahulu.");
            return;
        }
        if (resource === "products" && !form.category_id) {
            setError(
                "Pilih kategori Produk terlebih dahulu agar SKU dapat dibuat otomatis.",
            );
            return;
        }
        if (resource === "products" && false) {
            const ingredientTotal = (form.ingredients || []).reduce(
                (total, item) => {
                    const material = relations.materials.find(
                        (materialItem) => materialItem.id === item.material_id,
                    );
                    return (
                        total +
                        Number(item.quantity || 0) *
                            Number(material?.average_cost || 0)
                    );
                },
                0,
            );
            if (Number(form.average_cost || 0) < ingredientTotal) {
                setError(
                    `Harga modal minimal ${rupiah(ingredientTotal)}, sesuai total biaya ingredient.`,
                );
                return;
            }
            if (
                Number(form.selling_price || 0) < Number(form.average_cost || 0)
            ) {
                setError(
                    "Harga jual tidak boleh lebih rendah dari harga modal.",
                );
                return;
            }
        }
        setSaving(true);
        setError("");
        const { ingredients, recipe_id, ...masterFields } = form;
        const payload = {
            ...masterFields,
            ...(needsStore ? { outlet_id: formStore } : {}),
        };
        const url = `/api/master-data/${resource}${editing ? `/${editing.id}` : ""}`;
        try {
            const hasUpload = resource === "products";
            const uploadBody = new FormData();
            if (hasUpload) {
                Object.entries(payload).forEach(([key, value]) => {
                    if (key === "variants" && Array.isArray(value)) {
                        value.forEach((variant, index) => {
                            uploadBody.append(
                                `variants[${index}][name]`,
                                variant.name,
                            );
                            uploadBody.append(
                                `variants[${index}][is_active]`,
                                variant.is_active ? "1" : "0",
                            );
                        });
                    } else if (value instanceof File)
                        uploadBody.append(key, value);
                    else if (value !== null && value !== "")
                        uploadBody.append(
                            key,
                            typeof value === "boolean"
                                ? value
                                    ? "1"
                                    : "0"
                                : value,
                        );
                });
                if (editing) uploadBody.append("_method", "PUT");
            }
            const r = await fetch(url, {
                method: hasUpload ? "POST" : editing ? "PUT" : "POST",
                headers: {
                    ...(hasUpload
                        ? {}
                        : { "Content-Type": "application/json" }),
                    Accept: "application/json",
                    "X-CSRF-TOKEN": csrf(),
                },
                body: hasUpload ? uploadBody : JSON.stringify(payload),
            });
            const contentType = r.headers.get("content-type") || "";
            const b = contentType.includes("application/json")
                ? await r.json()
                : {};
            if (!r.ok) {
                setError(
                    Object.values(b.errors || {}).flat()[0] ||
                        b.message ||
                        `Data gagal disimpan (HTTP ${r.status}).`,
                );
                return;
            }
            if (resource === "products" && false && ingredients?.length) {
                const validIngredients = ingredients.filter(
                    (item) => item.material_id && item.quantity && item.unit_id,
                );
                if (validIngredients.length) {
                    const productId = editing?.id || b.id;
                    const recipeResponse = await fetch(
                        `/api/recipes${recipe_id ? `/${recipe_id}` : ""}`,
                        {
                            method: recipe_id ? "PUT" : "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Accept: "application/json",
                                "X-CSRF-TOKEN": csrf(),
                            },
                            body: JSON.stringify({
                                outlet_id: formStore,
                                product_id: productId,
                                yield_quantity: 1,
                                yield_unit_id: form.base_unit_id,
                                selling_price: Number(form.selling_price || 0),
                                items: validIngredients,
                            }),
                        },
                    );
                    const recipeBody = await recipeResponse.json();
                    if (!recipeResponse.ok) {
                        load();
                        setError(
                            Object.values(recipeBody.errors || {}).flat()[0] ||
                                recipeBody.message ||
                                "Produk sudah tersimpan, tetapi resep gagal disimpan. Edit produk tersebut untuk melanjutkan.",
                        );
                        return;
                    }
                }
            }
            setModal(false);
            load();
        } catch {
            setError(
                "Tidak dapat terhubung ke server. Periksa koneksi lalu coba kembali.",
            );
        } finally {
            setSaving(false);
        }
    }
    async function remove(row) {
        if (!window.confirm(`Hapus ${row.name}?`)) return;
        const r = await fetch(
            `/api/master-data/${resource}/${row.id}${needsStore ? `?outlet_id=${row.outlet_id || store}` : ""}`,
            {
                method: "DELETE",
                headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
            },
        );
        if (!r.ok) {
            const b = await r.json();
            alert(b.message);
            return;
        }
        load();
    }
    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">LANGKAH 1 / MASTER DATA</p>
                    <h1>Master Data</h1>
                    <p>
                        Siapkan data dasar lebih dahulu sebelum membuat order
                        barang dan mengelola stok.
                    </p>
                </div>
                <button
                    type="button"
                    className="primary-action"
                    onClick={() => open()}
                >
                    <Plus />
                    Tambah {config.label}
                </button>
            </section>
            <div className="flow-hint">
                <strong>Alur persiapan:</strong>
                <span>Kategori Produk & Bahan</span>
                <i>→</i>
                <span>Produk & Bahan Terpisah</span>
                <i>→</i>
                <span>Supplier & Gudang</span>
                <i>→</i>
                <span>Order Barang</span>
            </div>
            <div className="master-layout">
                {!productOnly && (
                    <aside className="master-tabs">
                        {masterResourceOrder.map((key) => {
                            const item = masterResources[key];
                            return (
                                <button
                                    className={resource === key ? "active" : ""}
                                    onClick={() => {
                                        setModal(false);
                                        setResource(key);
                                    }}
                                    key={key}
                                >
                                    <Boxes />
                                    <span>{item.menuLabel || item.label}</span>
                                </button>
                            );
                        })}
                        <button
                            className={
                                window.location.pathname === "/promotions"
                                    ? "active"
                                    : ""
                            }
                            onClick={() => {
                                window.location.href = "/promotions";
                            }}
                        >
                            <BadgePercent />
                            <span>Master Promo</span>
                        </button>
                    </aside>
                )}
                <section
                    className={`card master-card ${["warehouses", "tables"].includes(resource) ? "store-scoped-master-card" : ""}`}
                >
                    <div className="data-toolbar">
                        <div>
                            <h2>Data {config.label}</h2>
                            <p>{rows.length} data tersimpan</p>
                        </div>
                        {needsStore && (
                            <div className="master-store-filter">
                                <span>Filter Store</span>
                                <Select
                                    className="store-select2"
                                    classNamePrefix="select2"
                                    value={
                                        stores
                                            .map((s) => ({
                                                value: s.id,
                                                label: `${s.code} - ${s.name}`,
                                            }))
                                            .find(
                                                (option) =>
                                                    option.value === store,
                                            ) || null
                                    }
                                    onChange={(option) => {
                                        setModal(false);
                                        setStore(option?.value || "");
                                    }}
                                    options={stores.map((s) => ({
                                        value: s.id,
                                        label: `${s.code} - ${s.name}`,
                                    }))}
                                    placeholder="Semua Store"
                                    isSearchable
                                    isClearable
                                    noOptionsMessage={() =>
                                        "Store tidak ditemukan"
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <ListControls
                        view={listView}
                        placeholder={`Cari ${config.label.toLowerCase()}...`}
                        extra={
                            categoryField ? (
                                <Select
                                    className="category-filter-select"
                                    classNamePrefix="select2"
                                    value={
                                        (resource === "materials"
                                            ? relations.materialCategories
                                            : relations.categories
                                        )
                                            .map((category) => ({
                                                value: category.id,
                                                label: category.name,
                                            }))
                                            .find(
                                                (option) =>
                                                    option.value ===
                                                    categoryFilter,
                                            ) || null
                                    }
                                    options={(resource === "materials"
                                        ? relations.materialCategories
                                        : relations.categories
                                    ).map((category) => ({
                                        value: category.id,
                                        label: category.name,
                                    }))}
                                    onChange={(option) =>
                                        setCategoryFilter(option?.value || "")
                                    }
                                    placeholder="Semua kategori"
                                    isSearchable
                                    isClearable
                                    noOptionsMessage={() =>
                                        "Kategori tidak ditemukan"
                                    }
                                />
                            ) : null
                        }
                    />
                    {loadError ? (
                        <div className="master-load-error" role="alert">
                            <AlertTriangle />
                            <div>
                                <strong>Data {config.label} gagal dimuat</strong>
                                <span>{loadError}</span>
                            </div>
                            <button type="button" onClick={() => load()}>
                                Coba Lagi
                            </button>
                        </div>
                    ) : loadingRows ? (
                        <div className="data-loading" role="status">
                            <span />
                            <strong>Memuat data {config.label}...</strong>
                            <small>Menyiapkan data yang diperlukan saja.</small>
                        </div>
                    ) : listView.rows.length ? (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        {showStoreColumn && <th>Store</th>}
                                        {config.fields.map(([, label]) => (
                                            <th key={label}>{label}</th>
                                        ))}
                                        {resource === "products" && (
                                            <th>Ukuran Produk</th>
                                        )}
                                        {resource === "tables" && (
                                            <>
                                                <th>Kode Meja</th>
                                                <th>QR Meja</th>
                                                <th>Link Mobile</th>
                                            </>
                                        )}
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listView.rows.map((row) => (
                                        <tr
                                            className={
                                                resource === "tables"
                                                    ? `dining-table-row ${row.status}`
                                                    : undefined
                                            }
                                            key={row.id}
                                        >
                                            {showStoreColumn && (
                                                <td>
                                                    <strong>
                                                        {stores.find(
                                                            (outlet) =>
                                                                outlet.id ===
                                                                row.outlet_id,
                                                        )?.name || "-"}
                                                    </strong>
                                                </td>
                                            )}
                                            {config.fields.map(
                                                ([key, , type, relation]) => (
                                                    <td key={key}>
                                                        {resource ===
                                                            "tables" &&
                                                        key === "status" ? (
                                                            <span
                                                                className={`table-status-badge ${row.status}`}
                                                            >
                                                                <i />
                                                                {tableStatusLabels[
                                                                    row.status
                                                                ] || row.status}
                                                            </span>
                                                        ) : type === "image" ? (
                                                            row.image_path ? (
                                                                <img
                                                                    className="product-thumb"
                                                                    src={`/storage/${row.image_path}`}
                                                                    alt={
                                                                        row.name
                                                                    }
                                                                />
                                                            ) : (
                                                                <span className="product-thumb empty">
                                                                    <Package />
                                                                </span>
                                                            )
                                                        ) : type ===
                                                          "boolean" ? (
                                                            row[key] ? (
                                                                "Aktif"
                                                            ) : (
                                                                "Tidak aktif"
                                                            )
                                                        ) : type ===
                                                          "relation" ? (
                                                            relations[
                                                                relation
                                                            ]?.find(
                                                                (x) =>
                                                                    x.id ===
                                                                    row[key],
                                                            )?.name || "-"
                                                        ) : type ===
                                                          "number" ? (
                                                            key === "price" ? rupiah(row[key]) : decimalQty(row[key])
                                                        ) : (
                                                            String(
                                                                row[key] ?? "-",
                                                            )
                                                        )}
                                                    </td>
                                                ),
                                            )}
                                            {resource === "products" && (
                                                <td>
                                                    <div className="product-size-list">
                                                        {(
                                                            row.variants || []
                                                        ).map((variant) => (
                                                            <span
                                                                className={
                                                                    variant.is_active
                                                                        ? "active"
                                                                        : "inactive"
                                                                }
                                                                key={variant.id}
                                                            >
                                                                <b>
                                                                    {
                                                                        variant.name
                                                                    }
                                                                </b>
                                                                <small>
                                                                    {variant.is_active
                                                                        ? "Aktif"
                                                                        : "Nonaktif"}
                                                                </small>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            )}
                                            {resource === "tables" && (
                                                <>
                                                    <td>
                                                        <strong>
                                                            {row.code}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {row.qr_data && (
                                                            <div className="qr-table-cell">
                                                                <QRCodeSVG
                                                                    value={
                                                                        row.qr_data
                                                                    }
                                                                    size={72}
                                                                    level="M"
                                                                />
                                                                <button
                                                                    onClick={() =>
                                                                        window.open(
                                                                            row.qr_data,
                                                                            "_blank",
                                                                        )
                                                                    }
                                                                >
                                                                    Buka QR
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {row.qr_data ? (
                                                            <div className="mobile-table-link">
                                                                <a
                                                                    href={row.qr_data}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    Buka Mobile
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        await navigator.clipboard.writeText(row.qr_data);
                                                                    }}
                                                                >
                                                                    Salin Link
                                                                </button>
                                                                <small title={row.qr_data}>
                                                                    {row.qr_data}
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            "-"
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            <td>
                                                <div className="row-actions">
                                                    <button
                                                        onClick={() =>
                                                            open(row)
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="danger"
                                                        onClick={() =>
                                                            remove(row)
                                                        }
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
                    ) : (
                        <div className="empty-state">
                            <Boxes />
                            <h3>Belum ada data {config.label.toLowerCase()}</h3>
                            <p>
                                Gunakan tombol tambah untuk membuat data
                                pertama.
                            </p>
                            <button type="button" onClick={() => open()}>
                                <Plus />
                                Tambah data
                            </button>
                        </div>
                    )}
                </section>
            </div>
            {modal && (
                <div
                    className={
                        resource === "products"
                            ? "product-page-editor"
                            : "modal-backdrop"
                    }
                >
                    <div
                        className={`form-modal ${resource === "products" ? "product-modal" : ""}`}
                    >
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <Boxes />
                            </div>
                            <h2>
                                {editing ? "Edit" : "Tambah"} {config.label}
                            </h2>
                            <p>Lengkapi informasi di bawah ini.</p>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            {needsStore && (
                                <div
                                    className="modal-store-select store-owner-field"
                                >
                                    <label>
                                        Store pemilik {config.label.toLowerCase()} *
                                    </label>
                                    <Select
                                        className="store-select2"
                                        classNamePrefix="select2"
                                        value={
                                            stores
                                                .map((s) => ({
                                                    value: s.id,
                                                    label: `${s.code} - ${s.name}`,
                                                }))
                                                .find(
                                                    (option) =>
                                                        option.value ===
                                                        formStore,
                                                ) || null
                                        }
                                        onChange={(option) => {
                                            const selectedStore =
                                                option?.value || "";
                                            setFormStore(selectedStore);
                                            if (!editing)
                                                setStore(selectedStore);
                                        }}
                                        options={stores.map((s) => ({
                                            value: s.id,
                                            label: `${s.code} - ${s.name}`,
                                        }))}
                                        placeholder="Cari dan pilih store..."
                                        isSearchable
                                        isDisabled={!!editing}
                                        noOptionsMessage={() =>
                                            "Store tidak ditemukan"
                                        }
                                    />
                                    {editing && (
                                        <small>
                                            Store tidak dapat diubah saat
                                            mengedit data.
                                        </small>
                                    )}
                                    {!editing && resource === "warehouses" && (
                                        <small>
                                            Stok yang diterima akan tercatat
                                            pada Store dan gudang ini.
                                        </small>
                                    )}
                                </div>
                            )}
                            {config.fields.map(([key, label, type, options]) =>
                                type === "generated" ? null : (
                                    <div key={key}>
                                        <label>{label}</label>
                                        {type === "image" ? (
                                            <div className="product-image-upload">
                                                <div className="product-image-preview">
                                                    {form[key] instanceof
                                                    File ? (
                                                        <img
                                                            src={URL.createObjectURL(
                                                                form[key],
                                                            )}
                                                            alt="Preview produk"
                                                        />
                                                    ) : editing?.image_path ? (
                                                        <img
                                                            src={`/storage/${editing.image_path}`}
                                                            alt={editing.name}
                                                        />
                                                    ) : (
                                                        <Package />
                                                    )}
                                                </div>
                                                <label className="image-picker">
                                                    <Plus /> Pilih gambar
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        onChange={(e) =>
                                                            setForm({
                                                                ...form,
                                                                [key]:
                                                                    e.target
                                                                        .files?.[0] ||
                                                                    "",
                                                            })
                                                        }
                                                    />
                                                </label>
                                                <small>
                                                    JPG, PNG, atau WebP.
                                                    Maksimal 3 MB.
                                                </small>
                                            </div>
                                        ) : type === "select" ? (
                                            <Select
                                                className="form-select2"
                                                classNamePrefix="select2"
                                                value={
                                                    options
                                                        .map((o) => ({
                                                            value: o,
                                                            label: o,
                                                        }))
                                                        .find(
                                                            (o) =>
                                                                o.value ===
                                                                form[key],
                                                        ) || null
                                                }
                                                onChange={(option) =>
                                                    setForm({
                                                        ...form,
                                                        [key]:
                                                            option?.value || "",
                                                    })
                                                }
                                                options={options.map((o) => ({
                                                    value: o,
                                                    label: o,
                                                }))}
                                                placeholder={`Pilih ${label.toLowerCase()}`}
                                                isSearchable
                                            />
                                        ) : type === "relation" ? (
                                            <Select
                                                className="form-select2"
                                                classNamePrefix="select2"
                                                value={
                                                    relations[options]
                                                        ?.map((o) => ({
                                                            value: o.id,
                                                            label:
                                                                o.code && o.name
                                                                    ? `${o.code} - ${o.name}`
                                                                    : o.name,
                                                        }))
                                                        .find(
                                                            (o) =>
                                                                o.value ===
                                                                form[key],
                                                        ) || null
                                                }
                                                onChange={(option) =>
                                                    setForm({
                                                        ...form,
                                                        [key]:
                                                            option?.value || "",
                                                    })
                                                }
                                                options={relations[options]
                                                    ?.filter(
                                                        (o) =>
                                                            resource !==
                                                                "ingredient-modifiers" ||
                                                            !!editing ||
                                                            !rows.some(
                                                                (row) =>
                                                                    row.material_id ===
                                                                    o.id,
                                                            ),
                                                    )
                                                    .map((o) => ({
                                                        value: o.id,
                                                        label:
                                                            o.code && o.name
                                                                ? `${o.code} - ${o.name}`
                                                                : o.name,
                                                    }))}
                                                placeholder={`Cari ${label.toLowerCase()}...`}
                                                isSearchable
                                                isClearable={
                                                    key === "category_id"
                                                }
                                            />
                                        ) : type === "boolean" ? (
                                            <label className="switch-field">
                                                <input
                                                    type="checkbox"
                                                    checked={!!form[key]}
                                                    onChange={(e) =>
                                                        setForm({
                                                            ...form,
                                                            [key]: e.target
                                                                .checked,
                                                        })
                                                    }
                                                />
                                                <span>
                                                    {form[key]
                                                        ? "Aktif"
                                                        : "Tidak aktif"}
                                                </span>
                                            </label>
                                        ) : (
                                            <input
                                                type={type}
                                                min={
                                                    type === "number"
                                                        ? 0
                                                        : undefined
                                                }
                                                step={
                                                    type === "number"
                                                        ? "0.0001"
                                                        : undefined
                                                }
                                                value={form[key]}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        [key]: e.target.value,
                                                    })
                                                }
                                                required={
                                                    ![
                                                        "phone",
                                                        "email",
                                                    ].includes(key)
                                                }
                                            />
                                        )}
                                    </div>
                                ),
                            )}
                            {resource === "products" && (
                                <section className="product-variant-editor">
                                    <div className="variant-editor-heading">
                                        <div>
                                            <strong>Ukuran Produk</strong>
                                            <small>
                                                Satu produk memiliki ukuran S,
                                                M, dan L. Harga tambahan
                                                dihitung dari harga dasar
                                                produk.
                                            </small>
                                        </div>
                                        <span>3 VARIANT</span>
                                    </div>
                                    <div className="variant-editor-grid">
                                        {(form.variants || []).map(
                                            (variant, index) => (
                                                <article
                                                    key={variant.name}
                                                    className={
                                                        variant.is_active
                                                            ? "enabled"
                                                            : "disabled"
                                                    }
                                                >
                                                    <div className="variant-size-badge">
                                                        {variant.name}
                                                    </div>
                                                    <label className="switch-field compact">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                !!variant.is_active
                                                            }
                                                            onChange={(e) =>
                                                                setForm({
                                                                    ...form,
                                                                    variants:
                                                                        form.variants.map(
                                                                            (
                                                                                item,
                                                                                itemIndex,
                                                                            ) =>
                                                                                itemIndex ===
                                                                                index
                                                                                    ? {
                                                                                          ...item,
                                                                                          is_active:
                                                                                              e
                                                                                                  .target
                                                                                                  .checked,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                })
                                                            }
                                                        />
                                                        <span>
                                                            {variant.is_active
                                                                ? "Aktif"
                                                                : "Nonaktif"}
                                                        </span>
                                                    </label>
                                                </article>
                                            ),
                                        )}
                                    </div>
                                </section>
                            )}
                            {resource === "products" && false && (
                                <div className="product-ingredients">
                                    <div className="recipe-items-heading">
                                        <span>
                                            <strong>
                                                Ingredient / Resep Produk
                                            </strong>
                                            <small>
                                                Bahan akan mengurangi stok saat
                                                produk terjual.
                                            </small>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    ingredients: [
                                                        ...(form.ingredients ||
                                                            []),
                                                        {
                                                            material_id: "",
                                                            quantity: 1,
                                                            unit_id: "",
                                                        },
                                                    ],
                                                })
                                            }
                                        >
                                            <Plus /> Tambah ingredient
                                        </button>
                                    </div>
                                    <div className="ingredient-column-head">
                                        <span>Kode</span>
                                        <span>Ingredient</span>
                                        <span>Qty</span>
                                        <span>Satuan</span>
                                        <span>Harga</span>
                                        <span>Subtotal</span>
                                        <span />
                                    </div>
                                    {(form.ingredients || []).map(
                                        (ingredient, index) => {
                                            const selectedMaterial =
                                                relations.materials.find(
                                                    (material) =>
                                                        material.id ===
                                                        ingredient.material_id,
                                                );
                                            const ingredientSubtotal =
                                                Number(
                                                    ingredient.quantity || 0,
                                                ) *
                                                Number(
                                                    selectedMaterial?.average_cost ||
                                                        0,
                                                );
                                            return (
                                                <div
                                                    className="recipe-item-form product-ingredient-row"
                                                    key={index}
                                                >
                                                    <div className="ingredient-code">
                                                        {selectedMaterial?.sku ||
                                                            "-"}
                                                    </div>
                                                    <Select
                                                        className="ingredient-select2"
                                                        classNamePrefix="select2"
                                                        value={
                                                            relations.materials
                                                                .map(
                                                                    (
                                                                        material,
                                                                    ) => ({
                                                                        value: material.id,
                                                                        label: material.name,
                                                                    }),
                                                                )
                                                                .find(
                                                                    (option) =>
                                                                        option.value ===
                                                                        ingredient.material_id,
                                                                ) || null
                                                        }
                                                        onChange={(option) => {
                                                            const material =
                                                                relations.materials.find(
                                                                    (item) =>
                                                                        item.id ===
                                                                        option?.value,
                                                                );
                                                            const ingredients =
                                                                [
                                                                    ...form.ingredients,
                                                                ];
                                                            ingredients[index] =
                                                                {
                                                                    ...ingredient,
                                                                    material_id:
                                                                        option?.value ||
                                                                        "",
                                                                    unit_id:
                                                                        material?.base_unit_id ||
                                                                        "",
                                                                };
                                                            setForm({
                                                                ...form,
                                                                ingredients,
                                                            });
                                                        }}
                                                        options={relations.materials.map(
                                                            (material) => ({
                                                                value: material.id,
                                                                label: material.name,
                                                            }),
                                                        )}
                                                        placeholder="Cari ingredient..."
                                                        isSearchable
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="0.0001"
                                                        placeholder="Qty"
                                                        value={
                                                            ingredient.quantity
                                                        }
                                                        onChange={(e) => {
                                                            const ingredients =
                                                                [
                                                                    ...form.ingredients,
                                                                ];
                                                            ingredients[index] =
                                                                {
                                                                    ...ingredient,
                                                                    quantity:
                                                                        e.target
                                                                            .value,
                                                                };
                                                            setForm({
                                                                ...form,
                                                                ingredients,
                                                            });
                                                        }}
                                                    />
                                                    <Select
                                                        className="unit-select2"
                                                        classNamePrefix="select2"
                                                        value={
                                                            relations.units
                                                                .map(
                                                                    (unit) => ({
                                                                        value: unit.id,
                                                                        label: unit.code,
                                                                    }),
                                                                )
                                                                .find(
                                                                    (option) =>
                                                                        option.value ===
                                                                        ingredient.unit_id,
                                                                ) || null
                                                        }
                                                        onChange={(option) => {
                                                            const ingredients =
                                                                [
                                                                    ...form.ingredients,
                                                                ];
                                                            ingredients[index] =
                                                                {
                                                                    ...ingredient,
                                                                    unit_id:
                                                                        option?.value ||
                                                                        "",
                                                                };
                                                            setForm({
                                                                ...form,
                                                                ingredients,
                                                            });
                                                        }}
                                                        options={relations.units.map(
                                                            (unit) => ({
                                                                value: unit.id,
                                                                label: unit.code,
                                                            }),
                                                        )}
                                                        placeholder="Satuan"
                                                        isSearchable
                                                    />
                                                    <div className="ingredient-price">
                                                        {rupiah(
                                                            selectedMaterial?.average_cost ||
                                                                0,
                                                        )}
                                                    </div>
                                                    <strong className="ingredient-subtotal">
                                                        {rupiah(
                                                            ingredientSubtotal,
                                                        )}
                                                    </strong>
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            form.ingredients
                                                                .length === 1
                                                        }
                                                        onClick={() =>
                                                            setForm({
                                                                ...form,
                                                                ingredients:
                                                                    form.ingredients.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            index,
                                                                    ),
                                                            })
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </button>
                                                </div>
                                            );
                                        },
                                    )}
                                    {(() => {
                                        const total = (
                                            form.ingredients || []
                                        ).reduce((sum, item) => {
                                            const material =
                                                relations.materials.find(
                                                    (entry) =>
                                                        entry.id ===
                                                        item.material_id,
                                                );
                                            return (
                                                sum +
                                                Number(item.quantity || 0) *
                                                    Number(
                                                        material?.average_cost ||
                                                            0,
                                                    )
                                            );
                                        }, 0);
                                        const modalIsLow =
                                            Number(form.average_cost || 0) <
                                            total;
                                        const sellingIsLow =
                                            Number(form.selling_price || 0) <
                                            Number(form.average_cost || 0);
                                        return (
                                            <div className="ingredient-cost-summary">
                                                <span>
                                                    Total biaya ingredient
                                                    <strong>
                                                        {rupiah(total)}
                                                    </strong>
                                                </span>
                                                <span>
                                                    Harga modal
                                                    <strong>
                                                        {rupiah(
                                                            form.average_cost ||
                                                                0,
                                                        )}
                                                    </strong>
                                                </span>
                                                <span>
                                                    Harga jual
                                                    <strong>
                                                        {rupiah(
                                                            form.selling_price ||
                                                                0,
                                                        )}
                                                    </strong>
                                                </span>
                                                {(modalIsLow ||
                                                    sellingIsLow) && (
                                                    <div className="cost-warning">
                                                        <AlertTriangle />
                                                        {modalIsLow
                                                            ? "Harga modal kurang dari total ingredient."
                                                            : "Harga jual kurang dari harga modal."}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            <button className="login-submit" disabled={saving}>
                                {saving ? "Menyimpan..." : "Simpan data"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
