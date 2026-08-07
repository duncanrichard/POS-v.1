<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        [$from, $until, $outletId] = $this->filters($request);
        $outlets = DB::table('outlets')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')
            ->orderBy('name')->get(['id', 'code', 'name']);
        $orders = $this->orders($request, $from, $until, $outletId);
        $paid = (clone $orders)->where('o.payment_status', 'paid');
        $summary = (clone $paid)->selectRaw('count(*) transaction_count, coalesce(sum(o.subtotal),0) subtotal, coalesce(sum(o.discount_total),0) discount_total,
            coalesce(sum(o.tax_total),0) tax_total, coalesce(sum(o.service_total),0) service_total, coalesce(sum(o.grand_total),0) net_sales,
            coalesce(avg(o.grand_total),0) average_order')->first();
        $summary->open_bills = (clone $orders)->where('o.payment_status', 'open_bill')->count();
        $summary->open_bill_total = (float) (clone $orders)->where('o.payment_status', 'open_bill')->sum('o.grand_total');
        $summary->items_sold = (float) DB::table('order_items as oi')->joinSub((clone $paid)->select('o.id'), 'paid_orders', 'paid_orders.id', '=', 'oi.order_id')->sum('oi.quantity');

        $daily = (clone $paid)->selectRaw('date(o.ordered_at) report_date, count(*) transaction_count, sum(o.grand_total) total')
            ->groupByRaw('date(o.ordered_at)')->orderBy('report_date')->get();
        $payments = DB::table('payments as p')->join('orders as o', 'o.id', '=', 'p.order_id')->join('outlets as ot', 'ot.id', '=', 'o.outlet_id')
            ->where('ot.company_id', $request->user()->company_id)->where('p.status', 'paid')->whereBetween('p.paid_at', [$from, $until])
            ->when($outletId, fn ($query) => $query->where('o.outlet_id', $outletId))
            ->selectRaw('p.method, count(*) transaction_count, sum(p.amount) total')->groupBy('p.method')->orderByDesc('total')->get();
        $orderTypes = (clone $paid)->selectRaw('o.order_type, count(*) transaction_count, sum(o.grand_total) total')
            ->groupBy('o.order_type')->orderByDesc('total')->get();
        $outletDaily = (clone $paid)->selectRaw('date(o.ordered_at) report_date, ot.code outlet_code, ot.name outlet_name, count(*) transaction_count,
                sum(o.subtotal) subtotal, sum(o.discount_total) discount_total, sum(o.tax_total) tax_total, sum(o.grand_total) total')
            ->groupByRaw('date(o.ordered_at), ot.id, ot.code, ot.name')->orderBy('report_date')->orderBy('ot.name')->get();
        $topProducts = DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->join('outlets as ot', 'ot.id', '=', 'o.outlet_id')
            ->where('ot.company_id', $request->user()->company_id)->where('o.payment_status', 'paid')->whereBetween('o.ordered_at', [$from, $until])
            ->when($outletId, fn ($query) => $query->where('o.outlet_id', $outletId))
            ->selectRaw('oi.product_name_snapshot product_name, sum(oi.quantity) quantity, sum(oi.line_total) total')
            ->groupBy('oi.product_name_snapshot')->orderByDesc('quantity')->limit(15)->get();
        $cashiers = (clone $paid)->leftJoin('users as u', 'u.id', '=', 'o.cashier_id')
            ->selectRaw("coalesce(u.name, 'Tidak diketahui') cashier_name, count(*) transaction_count, sum(o.grand_total) total")
            ->groupBy('u.id', 'u.name')->orderByDesc('total')->get();
        $shifts = DB::table('pos_shifts as s')->join('outlets as ot', 'ot.id', '=', 's.outlet_id')->join('pos_registers as r', 'r.id', '=', 's.register_id')
            ->join('users as u', 'u.id', '=', 's.cashier_id')->where('ot.company_id', $request->user()->company_id)
            ->whereBetween('s.opened_at', [$from, $until])->when($outletId, fn ($query) => $query->where('s.outlet_id', $outletId))
            ->orderByDesc('s.opened_at')->limit(100)->get(['s.id', 's.shift_number', 's.status', 's.opening_cash', 's.expected_cash', 's.opened_at', 's.closed_at',
                'r.code as register_code', 'r.name as register_name', 'u.name as cashier_name', 'ot.name as outlet_name']);
        $transactions = (clone $orders)->leftJoin('users as u', 'u.id', '=', 'o.cashier_id')->leftJoin('payments as p', function ($join) {
                $join->on('p.order_id', '=', 'o.id')->where('p.status', '=', 'paid');
            })->orderByDesc('o.ordered_at')->limit(500)->get(['o.id', 'o.order_number', 'o.ordered_at', 'o.order_type', 'o.payment_status',
                'o.production_status', 'o.subtotal', 'o.discount_total', 'o.tax_total', 'o.grand_total', 'ot.name as outlet_name', 'u.name as cashier_name', 'p.method as payment_method']);

        return response()->json(['filters' => ['from' => $from->toDateString(), 'until' => $until->toDateString(), 'outlet_id' => $outletId],
            'data_status' => ['has_server_transactions' => DB::table('orders as check_orders')->join('outlets as check_outlets', 'check_outlets.id', '=', 'check_orders.outlet_id')
                ->where('check_outlets.company_id', $request->user()->company_id)->exists(),
                'message' => 'Laporan hanya menghitung transaksi POS yang berhasil tersimpan dan dibayar melalui server. Data Kitchen lokal lama tidak mempunyai data pembayaran dan tidak dihitung sebagai omzet.'],
            'outlets' => $outlets, 'summary' => $summary, 'daily_sales' => $daily, 'outlet_daily' => $outletDaily, 'payments' => $payments, 'order_types' => $orderTypes,
            'top_products' => $topProducts, 'cashiers' => $cashiers, 'shifts' => $shifts, 'transactions' => $transactions]);
    }

    public function export(Request $request): StreamedResponse
    {
        [$from, $until, $outletId] = $this->filters($request);
        $type = $request->validate(['report_type' => ['nullable', 'in:transactions,outlet_daily,staff,payments,products,shifts']])['report_type'] ?? 'transactions';
        [$title, $headers, $rows] = $this->exportRows($request, $from, $until, $outletId, $type);
        $filename = 'laporan-'.$type.'-'.$from->format('Ymd').'-'.$until->format('Ymd').'.xls';
        return response()->streamDownload(function () use ($title, $headers, $rows, $from, $until) {
            echo '<?xml version="1.0" encoding="UTF-8"?>';
            echo '<?mso-application progid="Excel.Sheet"?>';
            echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E9DDFB" ss:Pattern="Solid"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="#,##0"/></Style></Styles><Worksheet ss:Name="Laporan"><Table>';
            $write = function (array $cells, ?string $style = null) { echo '<Row>'; foreach ($cells as $cell) { $numeric = is_int($cell) || is_float($cell); echo '<Cell'.($style ? ' ss:StyleID="'.$style.'"' : '').'><Data ss:Type="'.($numeric ? 'Number' : 'String').'">'.htmlspecialchars((string) $cell, ENT_XML1).'</Data></Cell>'; } echo '</Row>'; };
            $write([$title]); $write(['Periode', $from->toDateString().' s/d '.$until->toDateString()]); $write([]); $write($headers, 'Header');
            foreach ($rows as $row) $write(array_values((array) $row));
            echo '</Table></Worksheet></Workbook>';
        }, $filename, ['Content-Type' => 'application/vnd.ms-excel; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    private function filters(Request $request): array
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'until' => ['nullable', 'date', 'after_or_equal:from'], 'outlet_id' => ['nullable', 'uuid']]);
        $from = Carbon::parse($data['from'] ?? today()->startOfMonth())->startOfDay();
        $until = Carbon::parse($data['until'] ?? today())->endOfDay();
        if ($from->diffInDays($until) > 366) throw ValidationException::withMessages(['from' => 'Rentang laporan maksimal 366 hari.']);
        $outletId = $data['outlet_id'] ?? $request->user()->outlet_id;
        if ($outletId) abort_unless(DB::table('outlets')->where('id', $outletId)->where('company_id', $request->user()->company_id)->exists(), 403);
        return [$from, $until, $outletId];
    }

    private function orders(Request $request, $from, $until, ?string $outletId)
    {
        return DB::table('orders as o')->join('outlets as ot', 'ot.id', '=', 'o.outlet_id')->where('ot.company_id', $request->user()->company_id)
            ->whereBetween('o.ordered_at', [$from, $until])->when($outletId, fn ($query) => $query->where('o.outlet_id', $outletId));
    }

    private function exportRows(Request $request, $from, $until, ?string $outletId, string $type): array
    {
        $base = $this->orders($request, $from, $until, $outletId)->where('o.payment_status', 'paid');
        return match ($type) {
            'outlet_daily' => ['Omzet Cabang Harian', ['Tanggal', 'Kode Cabang', 'Nama Cabang', 'Jumlah Transaksi', 'Subtotal', 'Diskon', 'Pajak', 'Omzet'],
                (clone $base)->selectRaw('date(o.ordered_at) report_date, ot.code outlet_code, ot.name outlet_name, count(*) transaction_count, sum(o.subtotal) subtotal, sum(o.discount_total) discount_total, sum(o.tax_total) tax_total, sum(o.grand_total) total')->groupByRaw('date(o.ordered_at), ot.id, ot.code, ot.name')->orderBy('report_date')->get()],
            'staff' => ['Penjualan per Staff', ['Nama Staff', 'Jumlah Transaksi', 'Subtotal', 'Diskon', 'Pajak', 'Total Penjualan'],
                (clone $base)->leftJoin('users as u', 'u.id', '=', 'o.cashier_id')->selectRaw("coalesce(u.name,'Tidak diketahui') cashier_name, count(*) transaction_count, sum(o.subtotal) subtotal, sum(o.discount_total) discount_total, sum(o.tax_total) tax_total, sum(o.grand_total) total")->groupBy('u.id', 'u.name')->orderByDesc('total')->get()],
            'payments' => ['Metode Pembayaran', ['Metode Pembayaran', 'Jumlah Transaksi', 'Total'], DB::table('payments as p')->join('orders as o', 'o.id', '=', 'p.order_id')->join('outlets as ot', 'ot.id', '=', 'o.outlet_id')->where('ot.company_id', $request->user()->company_id)->where('p.status', 'paid')->whereBetween('p.paid_at', [$from, $until])->when($outletId, fn ($q) => $q->where('o.outlet_id', $outletId))->selectRaw('p.method, count(*) transaction_count, sum(p.amount) total')->groupBy('p.method')->get()],
            'products' => ['Produk Terlaris', ['Produk', 'Jumlah Terjual', 'Omzet'], DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->join('outlets as ot', 'ot.id', '=', 'o.outlet_id')->where('ot.company_id', $request->user()->company_id)->where('o.payment_status', 'paid')->whereBetween('o.ordered_at', [$from, $until])->when($outletId, fn ($q) => $q->where('o.outlet_id', $outletId))->selectRaw('oi.product_name_snapshot product_name, sum(oi.quantity) quantity, sum(oi.line_total) total')->groupBy('oi.product_name_snapshot')->orderByDesc('quantity')->get()],
            'shifts' => ['Shift Kasir', ['Nomor Shift', 'Outlet', 'Register', 'Kasir', 'Status', 'Modal Awal', 'Kas Sistem', 'Dibuka', 'Ditutup'], DB::table('pos_shifts as s')->join('outlets as ot', 'ot.id', '=', 's.outlet_id')->join('pos_registers as r', 'r.id', '=', 's.register_id')->join('users as u', 'u.id', '=', 's.cashier_id')->where('ot.company_id', $request->user()->company_id)->whereBetween('s.opened_at', [$from, $until])->when($outletId, fn ($q) => $q->where('s.outlet_id', $outletId))->get(['s.shift_number', 'ot.name as outlet_name', 'r.name as register_name', 'u.name as cashier_name', 's.status', 's.opening_cash', 's.expected_cash', 's.opened_at', 's.closed_at'])],
            default => ['Detail Transaksi Penjualan', ['No. Order', 'Tanggal', 'Kode Outlet', 'Outlet', 'Kasir', 'Jenis Pesanan', 'Status Bayar', 'Metode Bayar', 'Subtotal', 'Diskon', 'Pajak', 'Service', 'Total'],
                (clone $base)->leftJoin('users as u', 'u.id', '=', 'o.cashier_id')->leftJoin('payments as p', fn ($join) => $join->on('p.order_id', '=', 'o.id')->where('p.status', '=', 'paid'))->orderBy('o.ordered_at')->get(['o.order_number', 'o.ordered_at', 'ot.code as outlet_code', 'ot.name as outlet_name', 'u.name as cashier_name', 'o.order_type', 'o.payment_status', 'p.method as payment_method', 'o.subtotal', 'o.discount_total', 'o.tax_total', 'o.service_total', 'o.grand_total'])],
        };
    }
}
