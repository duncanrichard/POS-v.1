import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";

import { AppShell, LoginPage } from "./components/layout/AppShell";
import {
    GenericModulePage,
    HoldingDashboardPage,
    modulePageDefinitions,
} from "./features/dashboard/DashboardPages";
import {
    MaterialWorkflowPage,
    ProductWorkflowPage,
} from "./features/catalog/CatalogWorkflows";
import { MasterDataPage } from "./features/catalog/MasterDataPage";
import { StockPage } from "./features/inventory/StockPage";
import {
    OrderRequestsPage,
    PurchaseOrdersPage,
    GoodsReceiptPage,
} from "./features/purchasing/PurchasingPages";
import { SettingsPage } from "./features/settings/SettingsPage";
import { StoreManagementPage } from "./features/stores/StorePages";
import { ReportPage, ReportDetailPage } from "./features/reports/ReportPage";
import {
    PromotionMasterPage,
    ProductPromotionPage,
    ProductBundlePage,
} from "./features/promotions/PromotionPages";

const pageRoutes = {
    "/": HoldingDashboardPage,
    "/holding": StoreManagementPage,
    "/master-data": MasterDataPage,
    "/materials": MaterialWorkflowPage,
    "/products": ProductWorkflowPage,
    "/promotions": PromotionMasterPage,
    "/product-promotions": ProductPromotionPage,
    "/product-bundles": ProductBundlePage,
    "/purchase-orders": PurchaseOrdersPage,
    "/order-requests": OrderRequestsPage,
    "/brand-operation/requests": OrderRequestsPage,
    "/purchasing": GoodsReceiptPage,
    "/stock": StockPage,
    "/settings": SettingsPage,
    "/reports": ReportPage,
    "/reports/outlet-daily": () => <ReportDetailPage reportType="outlet_daily" />,
    "/reports/staff": () => <ReportDetailPage reportType="staff" />,
    "/reports/payments": () => <ReportDetailPage reportType="payments" />,
    "/reports/products": () => <ReportDetailPage reportType="products" />,
    "/reports/shifts": () => <ReportDetailPage reportType="shifts" />,
};

const workflowRoutes = {
    "/material-prices": [MaterialWorkflowPage, "price"],
    "/recipes": [ProductWorkflowPage, "recipe"],
    "/product-prices": [ProductWorkflowPage, "price"],
};

function BackofficeApplication() {
    const path = window.location.pathname;
    if (path === "/login") return <LoginPage />;

    const PageComponent = pageRoutes[path];
    const [WorkflowComponent, initialStep] = workflowRoutes[path] || [];

    return (
        <AppShell path={path}>
            {PageComponent ? (
                <PageComponent />
            ) : WorkflowComponent ? (
                <WorkflowComponent initialStep={initialStep} />
            ) : (
                <GenericModulePage
                    page={
                        modulePageDefinitions[path] ||
                        modulePageDefinitions["/sales"]
                    }
                />
            )}
        </AppShell>
    );
}

const rootElement = document.getElementById("root");
const reactRoot =
    globalThis.__POSPHERE_REACT_ROOT__ ?? createRoot(rootElement);
globalThis.__POSPHERE_REACT_ROOT__ = reactRoot;
reactRoot.render(<BackofficeApplication />);
