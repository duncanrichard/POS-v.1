import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    CircleDollarSign,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { csrf, rupiah } from "../../shared/ui";

const today = () => new Date().toISOString().slice(0, 10);

export function ProductPricePage() {
    const [options, setOptions] = useState([]);
    const [rows, setRows] = useState([]);
    const [productId, setProductId] = useState("");
    const [modal, setModal] = useState(false);
    const [targetPeriod, setTargetPeriod] = useState(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        effective_from: today(),
        effective_until: "",
        start_locked: false,
        prices: [],
    });

    const load = () => {
        fetch("/api/product-prices")
            .then((response) => response.json())
            .then(setRows);
        fetch("/api/product-prices/options")
            .then((response) => response.json())
            .then(setOptions);
    };
    useEffect(() => {
        void load();
    }, []);

    const productOptions = useMemo(
        () =>
            Object.values(
                options.reduce((result, item) => {
                    result[item.product_id] ||= {
                        value: item.product_id,
                        label: `${item.sku} - ${item.name}`,
                        name: item.name,
                        sku: item.sku,
                        recipes: [],
                        price_locked: item.price_locked,
                        next_start_date: item.next_start_date,
                    };
                    result[item.product_id].recipes.push(item);
                    return result;
                }, {}),
            ),
        [options],
    );

    const productCards = useMemo(
        () =>
            Object.values(
                rows.reduce((products, row) => {
                    products[row.product_id] ||= {
                        id: row.product_id,
                        name: row.product_name,
                        sku: row.sku,
                        periods: {},
                    };
                    const key =
                        row.price_batch_id ||
                        `${row.product_id}-${row.effective_from}-${row.effective_until || "open"}`;
                    products[row.product_id].periods[key] ||= {
                        id: row.id,
                        key,
                        from: row.effective_from,
                        until: row.effective_until,
                        status: row.price_status,
                        prices: [],
                    };
                    products[row.product_id].periods[key].prices.push(row);
                    return products;
                }, {}),
            ).map((product) => ({
                ...product,
                periods: Object.values(product.periods).sort((a, b) =>
                    b.from.localeCompare(a.from),
                ),
            })),
        [rows],
    );

    function chooseProduct(option) {
        const product = productOptions.find(
            (item) => item.value === option?.value,
        );
        setProductId(product?.value || "");
        setError("");
        setForm({
            effective_from: product?.next_start_date || today(),
            effective_until: "",
            start_locked: Boolean(product?.next_start_date),
            prices: (product?.recipes || []).map((recipe) => {
                const cost =
                    recipe.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(item.quantity) * Number(item.unit_cost),
                        0,
                    ) / Number(recipe.yield_quantity || 1);
                return {
                    recipe_id: recipe.recipe_id,
                    variant_name: recipe.variant_name,
                    variant_sku: recipe.variant_sku,
                    hpp: cost,
                    selling_price: Number(recipe.current_selling_price || cost),
                };
            }),
        });
    }

    function open() {
        setTargetPeriod(null);
        setProductId("");
        setForm({
            effective_from: today(),
            effective_until: "",
            start_locked: false,
            prices: [],
        });
        setError("");
        setModal(true);
    }

    function openAddSizes(product, period) {
        const option = productOptions.find((item) => item.value === product.id);
        const existing = new Set(
            period.prices.map((price) => price.variant_id),
        );
        const missing = (option?.recipes || []).filter(
            (recipe) => !existing.has(recipe.variant_id),
        );
        setTargetPeriod({ ...period, product, action: "add" });
        setProductId(product.id);
        setError("");
        setForm({
            effective_from: period.from,
            effective_until: period.until || "",
            start_locked: true,
            prices: missing.map((recipe) => {
                const cost =
                    recipe.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(item.quantity) * Number(item.unit_cost),
                        0,
                    ) / Number(recipe.yield_quantity || 1);
                return {
                    recipe_id: recipe.recipe_id,
                    variant_name: recipe.variant_name,
                    variant_sku: recipe.variant_sku,
                    hpp: cost,
                    selling_price:
                        Number(recipe.current_selling_price || 0) > 0
                            ? Number(recipe.current_selling_price)
                            : cost,
                };
            }),
        });
        setModal(true);
    }

    function openEditPrices(product, period) {
        setTargetPeriod({ ...period, product, action: "edit" });
        setProductId(product.id);
        setError("");
        setForm({
            effective_from: period.from,
            effective_until: period.until || "",
            start_locked: true,
            prices: period.prices.map((price) => ({
                id: price.id,
                recipe_id: price.recipe_id,
                variant_name: price.variant_name,
                variant_sku: price.variant_sku,
                hpp: Number(price.hpp),
                selling_price: Number(price.selling_price),
            })),
        });
        setModal(true);
    }

    async function submit(event) {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            const editing = targetPeriod?.action === "edit";
            const response = await fetch(
                editing
                    ? `/api/product-prices/${targetPeriod.id}/prices`
                    : targetPeriod
                      ? `/api/product-prices/${targetPeriod.id}/sizes`
                      : "/api/product-prices",
                {
                    method: editing ? "PATCH" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "X-CSRF-TOKEN": csrf(),
                    },
                    body: JSON.stringify(
                        editing
                            ? {
                                  prices: form.prices.map((price) => ({
                                      id: price.id,
                                      selling_price: price.selling_price,
                                  })),
                              }
                            : targetPeriod
                              ? { prices: form.prices }
                              : { product_id: productId, ...form },
                    ),
                },
            );
            const body = await response.json();
            if (!response.ok) {
                setError(
                    Object.values(body.errors || {}).flat()[0] || body.message,
                );
                return;
            }
            setModal(false);
            load();
        } finally {
            setSaving(false);
        }
    }

    async function remove(period) {
        if (!window.confirm("Hapus seluruh harga S/M/L pada periode ini?"))
            return;
        const response = await fetch(`/api/product-prices/${period.id}`, {
            method: "DELETE",
            headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
        });
        if (response.ok) load();
    }

    async function closePeriod(period) {
        const date = window.prompt(
            "Tanggal akhir periode (YYYY-MM-DD)",
            today(),
        );
        if (!date) return;
        const response = await fetch(`/api/product-prices/${period.id}/close`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": csrf(),
            },
            body: JSON.stringify({ effective_until: date }),
        });
        const body = await response.json();
        if (!response.ok)
            return window.alert(body.message || "Periode gagal ditutup.");
        load();
    }

    return (
        <div className="content module-content product-price-v2">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">TAHAP 3 / PENETAPAN HARGA</p>
                    <h1>Produk Price</h1>
                    <p>Satu jadwal berlaku untuk seluruh ukuran produk.</p>
                </div>
                <button className="primary-action" onClick={open}>
                    <Plus /> Buat Jadwal Harga
                </button>
            </section>
            <section className="card price-product-list">
                <div className="data-toolbar">
                    <div>
                        <h2>Jadwal Harga Produk</h2>
                        <p>
                            {productCards.length} produk memiliki jadwal harga
                        </p>
                    </div>
                </div>
                {productCards.length ? (
                    <div className="price-product-grid">
                        {productCards.map((product) => (
                            <article
                                key={product.id}
                                className="price-product-card"
                            >
                                <header>
                                    <div className="price-product-icon">
                                        <CircleDollarSign />
                                    </div>
                                    <div>
                                        <strong>{product.name}</strong>
                                        <small>{product.sku}</small>
                                    </div>
                                    <b>{product.periods.length} PERIODE</b>
                                </header>
                                <div className="price-period-list">
                                    {product.periods.map((period) => (
                                        <section key={period.key}>
                                            <div className="price-period-head">
                                                <span
                                                    className={`price-status ${period.status}`}
                                                >
                                                    {period.status === "active"
                                                        ? "Aktif"
                                                        : period.status ===
                                                            "soon"
                                                          ? "Akan datang"
                                                          : "Selesai"}
                                                </span>
                                                <div>
                                                    <CalendarDays />
                                                    <strong>
                                                        {period.from} —{" "}
                                                        {period.until ||
                                                            "Tanpa batas"}
                                                    </strong>
                                                </div>
                                                <button
                                                    className="edit-period"
                                                    title="Edit harga periode"
                                                    onClick={() =>
                                                        openEditPrices(
                                                            product,
                                                            period,
                                                        )
                                                    }
                                                >
                                                    <Pencil /> Edit harga
                                                </button>
                                                {!period.until && (
                                                    <button
                                                        className="close-period"
                                                        onClick={() =>
                                                            closePeriod(period)
                                                        }
                                                    >
                                                        Tutup periode
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        remove(period)
                                                    }
                                                >
                                                    <Trash2 />
                                                </button>
                                            </div>
                                            <div className="variant-price-grid">
                                                {period.prices
                                                    .sort(
                                                        (a, b) =>
                                                            [
                                                                "S",
                                                                "M",
                                                                "L",
                                                            ].indexOf(
                                                                a.variant_name,
                                                            ) -
                                                            [
                                                                "S",
                                                                "M",
                                                                "L",
                                                            ].indexOf(
                                                                b.variant_name,
                                                            ),
                                                    )
                                                    .map((price) => (
                                                        <div key={price.id}>
                                                            <b>
                                                                {
                                                                    price.variant_name
                                                                }
                                                            </b>
                                                            <span>
                                                                <small>
                                                                    HPP
                                                                </small>
                                                                <strong>
                                                                    {rupiah(
                                                                        price.hpp,
                                                                    )}
                                                                </strong>
                                                            </span>
                                                            <span>
                                                                <small>
                                                                    Harga jual
                                                                </small>
                                                                <strong>
                                                                    {rupiah(
                                                                        price.selling_price,
                                                                    )}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                            {period.prices.length <
                                                (productOptions.find(
                                                    (item) =>
                                                        item.value ===
                                                        product.id,
                                                )?.recipes.length || 0) && (
                                                <button
                                                    className="add-period-sizes"
                                                    onClick={() =>
                                                        openAddSizes(
                                                            product,
                                                            period,
                                                        )
                                                    }
                                                >
                                                    <Plus /> Tambah ukuran ke
                                                    periode ini
                                                </button>
                                            )}
                                        </section>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <CircleDollarSign />
                        <h3>Belum ada jadwal harga</h3>
                        <p>Buat harga setelah resep produk tersedia.</p>
                    </div>
                )}
            </section>
            {modal && (
                <div className="modal-backdrop">
                    <section className="card price-batch-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <CircleDollarSign />
                            </div>
                            <span>
                                <h2>
                                    {targetPeriod?.action === "edit"
                                        ? "Edit Harga Produk"
                                        : targetPeriod
                                          ? "Tambah Ukuran Harga"
                                          : "Buat Jadwal Harga Produk"}
                                </h2>
                                <p>
                                    {targetPeriod
                                        ? `Periode ${targetPeriod.from} — ${targetPeriod.until || "Tanpa batas"}`
                                        : "Pilih produk, tentukan periode, lalu isi harga setiap ukuran."}
                                </p>
                            </span>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle />
                                {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            {!targetPeriod && (
                                <>
                                    <label>
                                        Produk yang sudah memiliki resep
                                    </label>
                                    <Select
                                        className="form-select2"
                                        classNamePrefix="select2"
                                        options={productOptions.map((item) => ({
                                            ...item,
                                            isDisabled: item.price_locked,
                                        }))}
                                        isOptionDisabled={(item) =>
                                            item.isDisabled
                                        }
                                        onChange={chooseProduct}
                                        placeholder="Cari produk..."
                                    />
                                </>
                            )}
                            {!productId && (
                                <div className="price-modal-guide">
                                    <CircleDollarSign />
                                    <span>
                                        <strong>
                                            Pilih produk terlebih dahulu
                                        </strong>
                                        <small>
                                            Hanya produk yang sudah mempunyai
                                            resep ukuran yang dapat dipilih.
                                        </small>
                                    </span>
                                </div>
                            )}
                            {productId && (
                                <>
                                    {targetPeriod?.action === "add" && (
                                        <div className="size-availability-summary">
                                            <div>
                                                <small>Sudah ada</small>
                                                <span>
                                                    {targetPeriod.prices.map(
                                                        (price) => (
                                                            <b
                                                                key={
                                                                    price.variant_id
                                                                }
                                                            >
                                                                {
                                                                    price.variant_name
                                                                }
                                                            </b>
                                                        ),
                                                    )}
                                                </span>
                                            </div>
                                            <div className="missing">
                                                <small>
                                                    Ukuran yang ditambahkan
                                                </small>
                                                <span>
                                                    {form.prices.map(
                                                        (price) => (
                                                            <b
                                                                key={
                                                                    price.recipe_id
                                                                }
                                                            >
                                                                {
                                                                    price.variant_name
                                                                }
                                                            </b>
                                                        ),
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {!targetPeriod && (
                                        <div className="batch-period-fields">
                                            <label>
                                                Tanggal mulai
                                                <input
                                                    type="date"
                                                    value={form.effective_from}
                                                    readOnly={form.start_locked}
                                                    onChange={(event) =>
                                                        setForm({
                                                            ...form,
                                                            effective_from:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    required
                                                />
                                                <small>
                                                    {form.start_locked
                                                        ? "Otomatis satu hari setelah periode sebelumnya."
                                                        : "Tentukan tanggal mulai harga pertama."}
                                                </small>
                                            </label>
                                            <label>
                                                Tanggal akhir <em>Opsional</em>
                                                <input
                                                    type="date"
                                                    min={form.effective_from}
                                                    value={form.effective_until}
                                                    onChange={(event) =>
                                                        setForm({
                                                            ...form,
                                                            effective_until:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                />
                                                <small>
                                                    Kosongkan untuk berlaku
                                                    tanpa batas.
                                                </small>
                                            </label>
                                        </div>
                                    )}
                                    <div className="batch-price-editor">
                                        {form.prices.map((price, index) => (
                                            <article key={price.recipe_id}>
                                                <div className="batch-size">
                                                    {price.variant_name}
                                                </div>
                                                <div>
                                                    <small>
                                                        {price.variant_sku}
                                                    </small>
                                                    <strong>
                                                        Ukuran{" "}
                                                        {price.variant_name}
                                                    </strong>
                                                </div>
                                                <label>
                                                    HPP
                                                    <input
                                                        type="number"
                                                        value={price.hpp}
                                                        readOnly
                                                    />
                                                </label>
                                                <label>
                                                    Harga jual
                                                    <input
                                                        type="number"
                                                        min={price.hpp}
                                                        step="any"
                                                        value={
                                                            price.selling_price
                                                        }
                                                        onChange={(event) =>
                                                            setForm({
                                                                ...form,
                                                                prices: form.prices.map(
                                                                    (
                                                                        item,
                                                                        itemIndex,
                                                                    ) =>
                                                                        itemIndex ===
                                                                        index
                                                                            ? {
                                                                                  ...item,
                                                                                  selling_price:
                                                                                      event
                                                                                          .target
                                                                                          .value,
                                                                              }
                                                                            : item,
                                                                ),
                                                            })
                                                        }
                                                        required
                                                    />
                                                </label>
                                            </article>
                                        ))}
                                    </div>
                                    <button
                                        className="login-submit"
                                        disabled={saving}
                                    >
                                        <CheckCircle2 />
                                        {saving
                                            ? "Menyimpan..."
                                            : targetPeriod?.action === "edit"
                                              ? "Simpan Perubahan Harga"
                                              : targetPeriod
                                                ? `Simpan Harga ${form.prices.map((price) => price.variant_name).join("/")}`
                                                : "Simpan Harga S/M/L"}
                                    </button>
                                </>
                            )}
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
