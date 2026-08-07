import React, { useState } from "react";
import { MasterDataPage } from "./MasterDataPage";
import { RecipePage } from "./RecipePage";
import { ProductPricePage } from "./ProductPricePage";
import { MaterialPricePage } from "../materials/MaterialPricePage";

export function ProductWorkflowPage({ initialStep = "product" }) {
    const [step, setStep] = useState(initialStep);
    return (
        <div className="product-workflow">
            <div className="workflow-steps">
                <button
                    className={step === "product" ? "active" : ""}
                    onClick={() => setStep("product")}
                >
                    <b>1</b>
                    <span>
                        <strong>Master Produk</strong>
                        <small>Buat identitas produk</small>
                    </span>
                </button>
                <i>→</i>
                <button
                    className={step === "recipe" ? "active" : ""}
                    onClick={() => setStep("recipe")}
                >
                    <b>2</b>
                    <span>
                        <strong>Resep Produk</strong>
                        <small>Susun ingredient dan qty</small>
                    </span>
                </button>
                <i>→</i>
                <button
                    className={step === "price" ? "active" : ""}
                    onClick={() => setStep("price")}
                >
                    <b>3</b>
                    <span>
                        <strong>Produk Price</strong>
                        <small>Tetapkan HPP dan harga jual</small>
                    </span>
                </button>
            </div>
            {step === "product" ? (
                <MasterDataPage initialResource="products" productOnly />
            ) : step === "recipe" ? (
                <RecipePage />
            ) : (
                <ProductPricePage />
            )}
        </div>
    );
}

export function MaterialWorkflowPage({ initialStep = "material" }) {
    const [step, setStep] = useState(initialStep);
    return (
        <div className="product-workflow material-workflow">
            <div className="workflow-steps material-workflow-steps">
                <button
                    className={step === "material" ? "active" : ""}
                    onClick={() => setStep("material")}
                >
                    <b>1</b>
                    <span>
                        <strong>Master Bahan</strong>
                        <small>Buat identitas dan satuan bahan</small>
                    </span>
                </button>
                <i>→</i>
                <button
                    className={step === "price" ? "active" : ""}
                    onClick={() => setStep("price")}
                >
                    <b>2</b>
                    <span>
                        <strong>Harga Bahan</strong>
                        <small>Tetapkan nominal dan periode harga</small>
                    </span>
                </button>
            </div>
            {step === "material" ? (
                <MasterDataPage initialResource="materials" productOnly />
            ) : (
                <MaterialPricePage />
            )}
        </div>
    );
}
