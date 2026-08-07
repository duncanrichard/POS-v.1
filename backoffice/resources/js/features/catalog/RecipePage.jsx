import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
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
} from "lucide-react";
import {
    csrf,
    decimalQty,
    ListControls,
    rupiah,
    useListView,
} from "../../shared/ui";

export function RecipePage() {
    const emptyItem = { material_id: "", quantity: 1, unit_id: "" };
    const emptyForm = {
        product_id: "",
        variant_id: "",
        yield_quantity: 1,
        yield_unit_id: "",
        selling_price: 0,
        items: [{ ...emptyItem }],
    };
    const [stores, setStores] = useState([]);
    const [store, setStore] = useState("");
    const [rows, setRows] = useState([]);
    const [options, setOptions] = useState({
        products: [],
        materials: [],
        units: [],
    });
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const groupedRows = useMemo(
        () =>
            Object.values(
                rows.reduce((groups, recipe) => {
                    groups[recipe.product_id] ||= {
                        id: recipe.product_id,
                        product_name: recipe.product_name,
                        sku: recipe.sku,
                        recipes: [],
                    };
                    groups[recipe.product_id].recipes.push(recipe);
                    return groups;
                }, {}),
            ),
        [rows],
    );
    const listView = useListView(groupedRows, 8);
    const productsWithoutRecipes = useMemo(
        () =>
            new Set(
                options.products
                    .filter(
                        (product) =>
                            !rows.some(
                                (recipe) => recipe.product_id === product.id,
                            ),
                    )
                    .map((product) => product.id),
            ).size,
        [options.products, rows],
    );

    function load() {
        fetch("/api/recipes")
            .then((r) => r.json())
            .then((x) => setRows(Array.isArray(x) ? x : []));
        fetch("/api/recipes/options")
            .then((r) => r.json())
            .then((x) => setOptions(x));
    }
    useEffect(() => {
        void load();
    }, []);

    function open(row = null) {
        setEditing(row);
        setError("");
        setForm(
            row
                ? {
                      product_id: row.product_id,
                      variant_id: row.variant_id,
                      yield_quantity: Number(row.yield_quantity),
                      yield_unit_id: row.yield_unit_id,
                      selling_price: Number(row.selling_price || 0),
                      items: row.items.map((item) => ({
                          material_id: item.material_id,
                          quantity: Number(item.quantity),
                          unit_id: item.unit_id,
                      })),
                  }
                : { ...emptyForm, items: [{ ...emptyItem }] },
        );
        setModal(true);
    }

    function selectVariant(variantId, productId) {
        const product = options.products.find(
            (item) => item.variant_id === variantId,
        );
        const existing = rows.find(
            (recipe) =>
                recipe.product_id === productId &&
                recipe.variant_id === variantId,
        );
        setEditing(existing || null);
        setError("");
        setForm(
            existing
                ? {
                      product_id: existing.product_id,
                      variant_id: existing.variant_id,
                      yield_quantity: Number(existing.yield_quantity),
                      yield_unit_id: existing.yield_unit_id,
                      selling_price: Number(existing.selling_price || 0),
                      items: existing.items.map((item) => ({
                          material_id: item.material_id,
                          quantity: Number(item.quantity),
                          unit_id: item.unit_id,
                      })),
                  }
                : {
                      ...form,
                      product_id: productId,
                      variant_id: variantId,
                      yield_unit_id:
                          product?.base_unit_id || form.yield_unit_id,
                      selling_price:
                          Number(product?.selling_price || 0) +
                          Number(product?.price_delta || 0),
                      items: form.items.map((item) => ({ ...item })),
                  },
        );
    }

    function addMissingVariant(baseRecipe, option) {
        setEditing(null);
        setError("");
        setForm({
            product_id: baseRecipe.product_id,
            variant_id: option.variant_id,
            yield_quantity: Number(baseRecipe.yield_quantity),
            yield_unit_id: baseRecipe.yield_unit_id,
            selling_price:
                Number(option.selling_price || 0) +
                Number(option.price_delta || 0),
            items: baseRecipe.items.map((item) => ({
                material_id: item.material_id,
                quantity: Number(item.quantity),
                unit_id: item.unit_id,
            })),
        });
        setModal(true);
    }

    function changeItem(index, key, value) {
        const items = form.items.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [key]: value } : item,
        );
        if (key === "material_id") {
            const material = options.materials.find((x) => x.id === value);
            if (material) items[index].unit_id = material.base_unit_id;
        }
        setForm({ ...form, items });
    }

    async function submit(e) {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        try {
            const response = await fetch(
                `/api/recipes${editing ? `/${editing.id}` : ""}`,
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
            const body = await response.json();
            if (!response.ok) {
                setError(
                    Object.values(body.errors || {}).flat()[0] || body.message,
                );
                return;
            }
            setModal(false);
            load();
        } catch {
            setError("Data resep gagal disimpan. Silakan coba kembali.");
        } finally {
            setSaving(false);
        }
    }

    async function remove(row) {
        if (
            !window.confirm(
                `Hapus resep ${row.product_name} ukuran ${row.variant_name}?`,
            )
        )
            return;
        const response = await fetch(`/api/recipes/${row.id}`, {
            method: "DELETE",
            headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
        });
        if (response.ok) load();
    }

    return (
        <div className="content module-content">
            <section className="module-hero">
                <div>
                    <p className="eyebrow">MASTER PRODUK / RESEP</p>
                    <h1>Resep & Bill of Materials</h1>
                    <p>
                        Tentukan bahan yang otomatis mengurangi stok untuk
                        setiap satu produk terjual.
                    </p>
                </div>
                <button
                    className="primary-action"
                    onClick={() => open()}
                    disabled={productsWithoutRecipes === 0}
                    title={
                        productsWithoutRecipes === 0
                            ? "Semua produk sudah memiliki resep. Tambahkan ukuran melalui Edit Resep."
                            : `${productsWithoutRecipes} produk belum memiliki resep`
                    }
                >
                    <Plus /> Buat Resep
                </button>
            </section>
            <section className="card recipe-card">
                <div className="data-toolbar">
                    <div>
                        <h2>Daftar Resep Produk</h2>
                        <p>{groupedRows.length} produk memiliki resep</p>
                    </div>
                    <Select
                        className="store-select2"
                        classNamePrefix="select2"
                        value={
                            stores
                                .map((s) => ({
                                    value: s.id,
                                    label: `${s.code} - ${s.name}`,
                                }))
                                .find((x) => x.value === store) || null
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
                    />
                </div>
                <ListControls
                    view={listView}
                    placeholder="Cari produk atau resep..."
                />
                {listView.rows.length ? (
                    <div className="recipe-grid">
                        {listView.rows.map((group) => (
                            <article
                                className="product-recipe-card"
                                key={group.id}
                            >
                                <div className="recipe-title">
                                    <div>
                                        <ChefHat />
                                    </div>
                                    <span>
                                        <strong>{group.product_name}</strong>
                                        <small>{group.sku}</small>
                                    </span>
                                    <div className="recipe-completion">
                                        <b>{group.recipes.length}/3 ukuran</b>
                                        <small>resep tersedia</small>
                                    </div>
                                </div>
                                <div className="recipe-variant-list">
                                    {group.recipes.map((recipe) => (
                                        <section key={recipe.id}>
                                            <div className="variant-recipe-head">
                                                <em className="recipe-size-badge">
                                                    {recipe.variant_name}
                                                </em>
                                                <span>
                                                    <strong>
                                                        {recipe.variant_sku}
                                                    </strong>
                                                    <small>
                                                        HPP {rupiah(recipe.hpp)}{" "}
                                                        • Jual{" "}
                                                        {rupiah(
                                                            recipe.selling_price,
                                                        )}
                                                    </small>
                                                </span>
                                            </div>
                                            <div className="ingredient-list">
                                                {recipe.items.map((item) => (
                                                    <div key={item.id}>
                                                        <span>
                                                            {item.material_name}
                                                        </span>
                                                        <strong>
                                                            {decimalQty(
                                                                item.quantity,
                                                            )}{" "}
                                                            {item.unit_code}
                                                        </strong>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="row-actions">
                                                <button
                                                    onClick={() => open(recipe)}
                                                >
                                                    Edit ukuran{" "}
                                                    {recipe.variant_name}
                                                </button>
                                                <button
                                                    className="danger"
                                                    onClick={() =>
                                                        remove(recipe)
                                                    }
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </section>
                                    ))}
                                    {["S", "M", "L"]
                                        .filter(
                                            (size) =>
                                                !group.recipes.some(
                                                    (recipe) =>
                                                        recipe.variant_name ===
                                                        size,
                                                ),
                                        )
                                        .map((size) => {
                                            const option =
                                                options.products.find(
                                                    (product) =>
                                                        product.id ===
                                                            group.id &&
                                                        product.variant_name ===
                                                            size,
                                                );
                                            return option ? (
                                                <button
                                                    className="missing-recipe-size"
                                                    key={size}
                                                    onClick={() =>
                                                        addMissingVariant(
                                                            group.recipes[0],
                                                            option,
                                                        )
                                                    }
                                                >
                                                    <Plus />
                                                    <span>
                                                        <strong>
                                                            Ukuran {size}
                                                        </strong>
                                                        <small>
                                                            Tambahkan komposisi
                                                            resep
                                                        </small>
                                                    </span>
                                                </button>
                                            ) : null;
                                        })}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <ChefHat />
                        <h3>Belum ada resep produk</h3>
                        <p>Buat resep agar pemakaian bahan dapat dihitung.</p>
                    </div>
                )}
            </section>
            {modal && (
                <div className="modal-backdrop">
                    <div className="form-modal recipe-modal">
                        <button
                            className="modal-close"
                            onClick={() => setModal(false)}
                        >
                            <X />
                        </button>
                        <div className="modal-heading">
                            <div>
                                <ChefHat />
                            </div>
                            <h2>
                                {form.product_id ? "Kelola" : "Buat"} Resep
                                Produk
                            </h2>
                        </div>
                        {error && (
                            <div className="login-error">
                                <AlertTriangle /> {error}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            {!form.product_id && (
                                <>
                                    <label>Produk baru</label>
                                    <select
                                        value={form.variant_id}
                                        onChange={(e) => {
                                            const product =
                                                options.products.find(
                                                    (x) =>
                                                        x.variant_id ===
                                                        e.target.value,
                                                );
                                            setForm({
                                                ...form,
                                                product_id: product?.id || "",
                                                variant_id: e.target.value,
                                                yield_unit_id:
                                                    product?.base_unit_id || "",
                                                selling_price:
                                                    Number(
                                                        product?.selling_price ||
                                                            0,
                                                    ) +
                                                    Number(
                                                        product?.price_delta ||
                                                            0,
                                                    ),
                                            });
                                        }}
                                        required
                                    >
                                        <option value="">
                                            Pilih produk dan ukuran
                                        </option>
                                        {options.products
                                            .filter(
                                                (product) =>
                                                    !rows.some(
                                                        (recipe) =>
                                                            recipe.product_id ===
                                                            product.id,
                                                    ),
                                            )
                                            .map((product) => (
                                                <option
                                                    value={product.variant_id}
                                                    key={product.variant_id}
                                                >
                                                    {product.variant_sku} -{" "}
                                                    {product.name} (
                                                    {product.variant_name})
                                                    {product.has_recipe
                                                        ? " — Sudah memiliki resep"
                                                        : ""}
                                                </option>
                                            ))}
                                    </select>
                                </>
                            )}
                            {form.product_id && (
                                <div className="recipe-size-tabs">
                                    <div>
                                        <strong>
                                            {
                                                options.products.find(
                                                    (product) =>
                                                        product.id ===
                                                        form.product_id,
                                                )?.name
                                            }
                                        </strong>
                                        <small>
                                            Pilih ukuran yang ingin disusun
                                        </small>
                                    </div>
                                    <nav>
                                        {options.products
                                            .filter(
                                                (product) =>
                                                    product.id ===
                                                    form.product_id,
                                            )
                                            .map((product) => (
                                                <button
                                                    type="button"
                                                    key={product.variant_id}
                                                    className={
                                                        form.variant_id ===
                                                        product.variant_id
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        selectVariant(
                                                            product.variant_id,
                                                            form.product_id,
                                                        )
                                                    }
                                                >
                                                    <b>
                                                        {product.variant_name}
                                                    </b>
                                                    <span>
                                                        {rows.some(
                                                            (recipe) =>
                                                                recipe.variant_id ===
                                                                product.variant_id,
                                                        )
                                                            ? "Sudah ada"
                                                            : "Belum ada"}
                                                    </span>
                                                </button>
                                            ))}
                                    </nav>
                                </div>
                            )}
                            {!editing && options.products.length > 0 && (
                                <div className="recipe-product-summary">
                                    <span>
                                        <strong>
                                            {
                                                options.products.filter(
                                                    (product) =>
                                                        !product.has_recipe,
                                                ).length
                                            }
                                        </strong>
                                        Produk tersedia
                                    </span>
                                    <span>
                                        <CheckCircle2 />
                                        {
                                            options.products.filter(
                                                (product) => product.has_recipe,
                                            ).length
                                        }{" "}
                                        Produk sudah memiliki Resep
                                    </span>
                                </div>
                            )}
                            {!editing &&
                                options.products.length > 0 &&
                                options.products.every(
                                    (product) => product.has_recipe,
                                ) && (
                                    <div className="recipe-product-notice">
                                        <CheckCircle2 /> Semua Produk sudah
                                        memiliki Resep.
                                    </div>
                                )}
                            <div className="form-columns">
                                <div>
                                    <label>Hasil resep</label>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="0.0001"
                                        value={form.yield_quantity}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                yield_quantity: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label>Satuan hasil</label>
                                    <select
                                        value={form.yield_unit_id}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                yield_unit_id: e.target.value,
                                            })
                                        }
                                        required
                                    >
                                        <option value="">Pilih satuan</option>
                                        {options.units.map((unit) => (
                                            <option
                                                value={unit.id}
                                                key={unit.id}
                                            >
                                                {unit.code} - {unit.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-columns recipe-price-fields">
                                <div>
                                    <label>HPP otomatis</label>
                                    <input
                                        value={rupiah(
                                            form.items.reduce(
                                                (sum, item) =>
                                                    sum +
                                                    Number(item.quantity || 0) *
                                                        Number(
                                                            options.materials.find(
                                                                (m) =>
                                                                    m.id ===
                                                                    item.material_id,
                                                            )?.average_cost ||
                                                                0,
                                                        ),
                                                0,
                                            ) /
                                                Number(
                                                    form.yield_quantity || 1,
                                                ),
                                        )}
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label>Harga jual</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={form.selling_price}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                selling_price: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <div className="recipe-items-heading">
                                <strong>Daftar bahan</strong>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setForm({
                                            ...form,
                                            items: [
                                                ...form.items,
                                                { ...emptyItem },
                                            ],
                                        })
                                    }
                                >
                                    <Plus /> Tambah bahan
                                </button>
                            </div>
                            {form.items.map((item, index) => (
                                <div className="recipe-item-form" key={index}>
                                    <select
                                        value={item.material_id}
                                        onChange={(e) =>
                                            changeItem(
                                                index,
                                                "material_id",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    >
                                        <option value="">Pilih bahan</option>
                                        {options.materials.map((material) => (
                                            <option
                                                value={material.id}
                                                key={material.id}
                                            >
                                                {material.sku} - {material.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="0.0001"
                                        value={item.quantity}
                                        onChange={(e) =>
                                            changeItem(
                                                index,
                                                "quantity",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    />
                                    <select
                                        value={item.unit_id}
                                        onChange={(e) =>
                                            changeItem(
                                                index,
                                                "unit_id",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    >
                                        <option value="">Satuan</option>
                                        {options.units.map((unit) => (
                                            <option
                                                value={unit.id}
                                                key={unit.id}
                                            >
                                                {unit.code}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        disabled={form.items.length === 1}
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                items: form.items.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            })
                                        }
                                    >
                                        <Trash2 />
                                    </button>
                                </div>
                            ))}
                            <button className="login-submit" disabled={saving}>
                                {saving ? "Menyimpan..." : "Simpan resep"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
