<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $outletId = $request->query('outlet_id', $request->user()->outlet_id);
        if ($outletId) {
            abort_unless(DB::table('outlets')->where('id', $outletId)->where('company_id', $request->user()->company_id)->exists(), 403);
        }
        $companyOutletIds = DB::table('outlets')->where('company_id', $request->user()->company_id)->select('id');

        $balances = DB::table('inventory_balances as b')
                ->join('warehouses as w', 'w.id', '=', 'b.warehouse_id')
                ->join('products as p', 'p.id', '=', 'b.product_id')
                ->join('units as u', 'u.id', '=', 'p.base_unit_id')
                ->join('outlets as o', 'o.id', '=', 'w.outlet_id')
                ->when($outletId, fn ($query) => $query->where('w.outlet_id', $outletId),
                    fn ($query) => $query->whereIn('w.outlet_id', $companyOutletIds))
                ->select('b.*', 'w.outlet_id', 'o.name as outlet_name', 'w.name as warehouse_name', 'p.sku', 'p.name as product_name', 'p.is_active as item_is_active', 'u.code as unit_code',
                    DB::raw("'product' as stock_type"), DB::raw('null as buffer_stock'), DB::raw('null as stock_barrier'))
                ->orderBy('p.name')->get();

        $materialBalances = DB::table('material_inventory_balances as b')
            ->join('warehouses as w', 'w.id', '=', 'b.warehouse_id')
            ->join('materials as m', 'm.id', '=', 'b.material_id')
            ->join('units as u', 'u.id', '=', 'm.base_unit_id')
            ->join('outlets as o', 'o.id', '=', 'w.outlet_id')
            ->when($outletId, fn ($query) => $query->where('w.outlet_id', $outletId),
                fn ($query) => $query->whereIn('w.outlet_id', $companyOutletIds))
            ->select('b.*', 'w.outlet_id', 'o.name as outlet_name', 'w.name as warehouse_name',
                'm.sku', 'm.name as product_name', 'm.is_active as item_is_active', 'u.code as unit_code', 'm.buffer_stock', 'm.stock_barrier',
                DB::raw("'material' as stock_type"))
            ->orderBy('m.name')->get();
        $balances = $balances->concat($materialBalances)->values();
        $balances->transform(function ($balance) {
            $available = max(0, (float) $balance->quantity_on_hand - (float) $balance->quantity_reserved);
            $buffer = $balance->buffer_stock === null ? null : (float) $balance->buffer_stock;
            $barrier = $balance->stock_barrier === null ? null : (float) $balance->stock_barrier;
            $balance->quantity_available = $available;
            $balance->stock_status = $buffer !== null && $available <= $buffer
                ? 'critical'
                : ($barrier !== null && $available <= $barrier ? 'restock' : 'safe');
            return $balance;
        });

        return response()->json([
            'balances' => $balances,
            'summary' => [
                'sku' => $balances->count(),
                'value' => $balances->sum(fn ($balance) =>
                    (float) $balance->quantity_on_hand * (float) $balance->average_cost),
                'critical' => $balances->where('stock_status', 'critical')->count(),
                'restock' => $balances->where('stock_status', 'restock')->count(),
                'safe' => $balances->where('stock_status', 'safe')->count(),
            ],
        ]);
    }
}
