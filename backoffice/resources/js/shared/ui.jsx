import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

export const csrf = () =>
    document.querySelector('meta[name="csrf-token"]')?.content;
export const rupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
export const decimalQty = (value) =>
    Number(value || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });
export function useListView(items, pageSize = 10) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const filtered = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return items;
        return items.filter((item) =>
            Object.values(item || {}).some(
                (value) =>
                    typeof value !== "object" &&
                    String(value ?? "")
                        .toLowerCase()
                        .includes(keyword),
            ),
        );
    }, [items, search]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    useEffect(() => setPage(1), [search, items]);
    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);
    return {
        search,
        setSearch,
        page,
        setPage,
        pageCount,
        total: filtered.length,
        rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    };
}
export function ListControls({
    view,
    placeholder = "Cari data...",
    extra = null,
}) {
    return (
        <div className="list-controls">
            <label>
                <Search />
                <input
                    value={view.search}
                    onChange={(event) => view.setSearch(event.target.value)}
                    placeholder={placeholder}
                />
            </label>
            {extra}
            <div className="pagination">
                <button
                    type="button"
                    onClick={() => view.setPage(view.page - 1)}
                    disabled={view.page <= 1}
                >
                    Sebelumnya
                </button>
                <span>
                    Halaman <strong>{view.page}</strong> dari {view.pageCount}
                </span>
                <button
                    type="button"
                    onClick={() => view.setPage(view.page + 1)}
                    disabled={view.page >= view.pageCount}
                >
                    Berikutnya
                </button>
            </div>
        </div>
    );
}
