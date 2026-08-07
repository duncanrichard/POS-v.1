<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GoodsReceiptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $outletId = $this->outletId($request, false);
        $companyId = $request->user()->company_id;
        $orders = DB::table('purchase_orders as po')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('o.company_id', $companyId)
            ->when($outletId, fn ($q) => $q->where('po.outlet_id', $outletId))
            ->whereIn('po.status', ['approved', 'partially_received'])
            ->whereNull('po.deleted_at')
            ->select('po.id', 'po.po_number', 'po.status', 'po.expected_date', 'po.updated_at',
                'o.name as outlet_name', DB::raw("coalesce(s.name, 'Ditentukan pusat') as supplier_name"))
            ->orderByDesc('po.updated_at')->get();

        $receipts = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('o.company_id', $companyId)
            ->when($outletId, fn ($q) => $q->where('po.outlet_id', $outletId))
            ->whereNull('gr.deleted_at')
            ->select('gr.*', 'po.po_number', 'o.name as outlet_name')
            ->orderByDesc('gr.received_at')->limit(50)->get();

        return response()->json(['orders' => $orders, 'receipts' => $receipts]);
    }

    public function show(Request $request, string $purchaseOrderId): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $order = DB::table('purchase_orders as po')->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('po.id', $purchaseOrderId)->where('o.company_id', $companyId)
            ->whereIn('po.status', ['approved', 'partially_received'])
            ->select('po.*', 'o.name as outlet_name')->first();
        abort_unless($order, 404, 'Order tidak tersedia untuk penerimaan.');
        if ($request->user()->outlet_id) abort_unless($request->user()->outlet_id === $order->outlet_id, 403);

        $items = DB::table('purchase_order_items as poi')
            ->join('materials as m', 'm.id', '=', 'poi.material_id')
            ->join('units as u', 'u.id', '=', 'poi.unit_id')
            ->leftJoinSub(
                DB::table('goods_receipt_items')->selectRaw('purchase_order_item_id, sum(accepted_qty + rejected_qty) processed_qty')
                    ->groupBy('purchase_order_item_id'), 'processed', 'processed.purchase_order_item_id', '=', 'poi.id'
            )->where('poi.purchase_order_id', $purchaseOrderId)
            ->select('poi.id', 'poi.material_id', 'poi.unit_id', 'poi.ordered_qty', 'poi.unit_cost',
                'm.name as material_name', 'm.sku', 'u.code as unit_code',
                DB::raw('coalesce(processed.processed_qty, 0) as processed_qty'))
            ->get()->map(function ($item) {
                $item->remaining_qty = max(0, (float) $item->ordered_qty - (float) $item->processed_qty);
                return $item;
            })->values();

        $warehouses = DB::table('warehouses')->where('outlet_id', $order->outlet_id)
            ->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']);
        return response()->json(['order' => $order, 'items' => $items, 'warehouses' => $warehouses]);
    }

    public function receipt(Request $request, string $id): JsonResponse
    {
        $header = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->join('warehouses as w', 'w.id', '=', 'gr.warehouse_id')
            ->leftJoin('users as u', 'u.id', '=', 'gr.received_by')
            ->where('gr.id', $id)->where('o.company_id', $request->user()->company_id)
            ->when($request->user()->outlet_id, fn ($q, $outletId) => $q->where('po.outlet_id', $outletId))
            ->whereNull('gr.deleted_at')
            ->select('gr.*', 'po.po_number', 'o.name as outlet_name', 'w.name as warehouse_name', 'u.name as received_by_name')
            ->first();
        abort_unless($header, 404);
        $items = DB::table('goods_receipt_items as gri')
            ->join('materials as m', 'm.id', '=', 'gri.material_id')
            ->join('units as u', 'u.id', '=', 'gri.unit_id')
            ->where('gri.goods_receipt_id', $id)
            ->get(['gri.*', 'm.name as material_name', 'm.sku', 'u.code as unit_code']);
        return response()->json(['header' => $header, 'items' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purchase_order_id' => ['required', 'uuid', 'exists:purchase_orders,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'distinct', 'uuid', 'exists:purchase_order_items,id'],
            'items.*.accepted_qty' => ['required', 'numeric', 'min:0'],
            'items.*.rejected_qty' => ['required', 'numeric', 'min:0'],
            'items.*.qc_note' => ['nullable', 'string', 'max:500'],
        ]);

        $receiptId = (string) Str::uuid();
        $result = DB::transaction(function () use ($request, $data, $receiptId) {
            $order = DB::table('purchase_orders as po')->join('outlets as o', 'o.id', '=', 'po.outlet_id')
                ->where('po.id', $data['purchase_order_id'])->where('o.company_id', $request->user()->company_id)
                ->whereIn('po.status', ['approved', 'partially_received'])->lockForUpdate()
                ->select('po.*')->first();
            abort_unless($order, 422, 'Order belum disetujui atau sudah selesai diterima.');
            if ($request->user()->outlet_id) abort_unless($request->user()->outlet_id === $order->outlet_id, 403);
            abort_unless(DB::table('warehouses')->where('id', $data['warehouse_id'])->where('outlet_id', $order->outlet_id)->exists(), 422, 'Gudang tidak sesuai dengan store order.');

            $poItems = DB::table('purchase_order_items')->where('purchase_order_id', $order->id)
                ->whereIn('id', collect($data['items'])->pluck('purchase_order_item_id'))->lockForUpdate()->get()->keyBy('id');
            $hasIssue = false;
            foreach ($data['items'] as $index => $input) {
                $item = $poItems->get($input['purchase_order_item_id']);
                if (! $item || ! $item->material_id) throw ValidationException::withMessages(["items.$index" => 'Barang tidak termasuk dalam order.']);
                $processed = (float) (DB::table('goods_receipt_items')
                    ->where('purchase_order_item_id', $item->id)
                    ->selectRaw('coalesce(sum(accepted_qty + rejected_qty), 0) as total')
                    ->value('total') ?? 0);
                $remaining = (float) $item->ordered_qty - $processed;
                $delivered = (float) $input['accepted_qty'] + (float) $input['rejected_qty'];
                if ($delivered <= 0 || $delivered > $remaining + 0.00001) {
                    throw ValidationException::withMessages(["items.$index.accepted_qty" => 'Total diterima dan ditolak harus lebih dari 0 dan tidak boleh melebihi sisa order.']);
                }
                if ((float) $input['rejected_qty'] > 0 && empty($input['qc_note'])) {
                    throw ValidationException::withMessages(["items.$index.qc_note" => 'Catatan QC wajib untuk barang yang ditolak.']);
                }
                $hasIssue = $hasIssue || (float) $input['rejected_qty'] > 0 || abs($delivered - $remaining) > 0.00001;
            }

            $number = 'GR-'.now()->format('Ymd').'-'.str_pad((string) (DB::table('goods_receipts')->whereDate('created_at', today())->count() + 1), 4, '0', STR_PAD_LEFT);
            DB::table('goods_receipts')->insert([
                'id' => $receiptId, 'purchase_order_id' => $order->id, 'warehouse_id' => $data['warehouse_id'],
                'receipt_number' => $number, 'status' => 'posted', 'qc_status' => $hasIssue ? 'issue' : 'passed',
                'notes' => $data['notes'] ?? null, 'received_by' => $request->user()->id,
                'received_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $movementId = DB::table('inventory_movements')->insertGetId([
                'movement_uuid' => (string) Str::uuid(), 'warehouse_id' => $data['warehouse_id'],
                'movement_type' => 'purchase_receipt', 'reference_type' => 'goods_receipt', 'reference_id' => $receiptId,
                'idempotency_key' => 'goods-receipt:'.$receiptId, 'posted_at' => now(),
                'metadata' => json_encode(['purchase_order_id' => $order->id, 'po_number' => $order->po_number]),
                'created_at' => now(), 'updated_at' => now(),
            ]);

            foreach ($data['items'] as $input) {
                $item = $poItems->get($input['purchase_order_item_id']);
                $accepted = (float) $input['accepted_qty'];
                $rejected = (float) $input['rejected_qty'];
                DB::table('goods_receipt_items')->insert([
                    'goods_receipt_id' => $receiptId, 'purchase_order_item_id' => $item->id,
                    'material_id' => $item->material_id, 'unit_id' => $item->unit_id, 'ordered_qty' => $item->ordered_qty,
                    'accepted_qty' => $accepted, 'rejected_qty' => $rejected,
                    'qc_status' => $rejected > 0 ? 'issue' : 'passed', 'qc_note' => $input['qc_note'] ?? null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('purchase_order_items')->where('id', $item->id)->increment('received_qty', $accepted, ['updated_at' => now()]);
                if ($accepted > 0) {
                    DB::table('inventory_movement_items')->insert([
                        'inventory_movement_id' => $movementId, 'product_id' => null, 'variant_id' => null,
                        'material_id' => $item->material_id, 'unit_id' => $item->unit_id, 'direction' => 'IN',
                        'quantity' => $accepted, 'unit_cost' => $item->unit_cost,
                    ]);
                    $balance = DB::table('material_inventory_balances')->where('warehouse_id', $data['warehouse_id'])
                        ->where('material_id', $item->material_id)->lockForUpdate()->first();
                    if ($balance) {
                        $oldQty = (float) $balance->quantity_on_hand;
                        $newQty = $oldQty + $accepted;
                        $average = $newQty > 0 ? (($oldQty * (float) $balance->average_cost) + ($accepted * (float) $item->unit_cost)) / $newQty : 0;
                        DB::table('material_inventory_balances')->where('id', $balance->id)->update(['quantity_on_hand' => $newQty, 'average_cost' => $average, 'updated_at' => now()]);
                    } else {
                        DB::table('material_inventory_balances')->insert(['warehouse_id' => $data['warehouse_id'], 'material_id' => $item->material_id,
                            'quantity_on_hand' => $accepted, 'quantity_reserved' => 0, 'average_cost' => $item->unit_cost, 'created_at' => now(), 'updated_at' => now()]);
                    }
                }
            }
            DB::table('goods_receipts')->where('id', $receiptId)->update(['posted_movement_id' => $movementId]);
            $remaining = DB::table('purchase_order_items as poi')->leftJoinSub(
                DB::table('goods_receipt_items')->selectRaw('purchase_order_item_id, sum(accepted_qty + rejected_qty) processed')->groupBy('purchase_order_item_id'),
                'gri', 'gri.purchase_order_item_id', '=', 'poi.id')
                ->where('poi.purchase_order_id', $order->id)->whereRaw('coalesce(gri.processed, 0) < poi.ordered_qty')->exists();
            DB::table('purchase_orders')->where('id', $order->id)->update(['status' => $remaining ? 'partially_received' : ($hasIssue ? 'received_with_issue' : 'received'), 'updated_at' => now()]);
            return ['id' => $receiptId, 'receipt_number' => $number, 'message' => 'Penerimaan dan QC berhasil diposting. Stok barang lolos QC telah bertambah.'];
        });
        return response()->json($result, 201);
    }

    private function outletId(Request $request, bool $required = true): ?string
    {
        $id = $request->query('outlet_id', $request->user()->outlet_id);
        if ($required) abort_unless($id, 422, 'Pilih store terlebih dahulu.');
        if ($id) abort_unless(DB::table('outlets')->where('id', $id)->where('company_id', $request->user()->company_id)->exists(), 403);
        return $id;
    }
}
