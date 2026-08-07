<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PosOrderController extends Controller
{
    public function tables(Request $request): JsonResponse
    {
        $outletId = $request->user()->outlet_id;
        $outlet = DB::table('outlets')->where('id', $outletId)->first(['id', 'code', 'name']);
        $tables = DB::table('dining_tables')->where('outlet_id', $outletId)->whereNull('deleted_at')
            ->orderBy('table_number')->get(['id', 'table_number', 'code', 'name', 'capacity', 'status'])
            ->map(function ($table) {
                $sessionIds = DB::table('table_sessions')->where('dining_table_id', $table->id)
                    ->where('status', 'open')->pluck('id');
                $orders = $sessionIds->isEmpty() ? collect() : DB::table('orders')->whereIn('table_session_id', $sessionIds)->get(['payment_status']);

                $effectiveStatus = $sessionIds->isNotEmpty() ? 'occupied' : $table->status;

                return [
                    ...(array) $table,
                    'status' => $effectiveStatus,
                    'open_session_count' => $sessionIds->count(),
                    'open_order_count' => $orders->count(),
                    'unpaid_order_count' => $orders->whereNotIn('payment_status', ['paid', 'voided'])->count(),
                ];
            });

        return response()->json(['outlet' => $outlet, 'tables' => $tables]);
    }

    public function releaseTable(Request $request, string $table): JsonResponse
    {
        $tableNumber = DB::transaction(function () use ($request, $table) {
            $row = DB::table('dining_tables')->where('id', $table)->where('outlet_id', $request->user()->outlet_id)
                ->whereNull('deleted_at')->lockForUpdate()->first();
            abort_unless($row, 404, 'Meja tidak ditemukan pada store aktif.');
            abort_if($row->status === 'inactive', 409, 'Meja nonaktif tidak dapat dijadikan tersedia dari POS.');

            $sessionIds = DB::table('table_sessions')->where('dining_table_id', $row->id)
                ->where('status', 'open')->lockForUpdate()->pluck('id');
            $hasUnpaidBill = $sessionIds->isNotEmpty() && DB::table('orders')->whereIn('table_session_id', $sessionIds)
                ->whereNotIn('payment_status', ['paid', 'voided'])->exists();
            abort_if($hasUnpaidBill, 409, 'Meja masih memiliki tagihan yang belum lunas. Selesaikan pembayaran terlebih dahulu.');

            if ($sessionIds->isNotEmpty()) {
                DB::table('table_sessions')->whereIn('id', $sessionIds)->update([
                    'status' => 'closed', 'closed_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('dining_tables')->where('id', $row->id)->update(['status' => 'available', 'updated_at' => now()]);

            return $row->table_number;
        }, 3);

        return response()->json(['message' => 'Meja '.$tableNumber.' sudah kosong dan tersedia kembali.']);
    }

    public function selfService(Request $request): JsonResponse
    {
        $orders = DB::table('orders as o')->leftJoin('table_sessions as ts', 'ts.id', '=', 'o.table_session_id')
            ->leftJoin('dining_tables as dt', 'dt.id', '=', 'ts.dining_table_id')
            ->where('o.outlet_id', $request->user()->outlet_id)->where('o.source', 'self_service')->whereDate('o.ordered_at', today())
            ->orderByDesc('o.ordered_at')->limit(100)
            ->get(['o.id', 'o.order_number', 'o.payment_status', 'o.production_status', 'o.grand_total', 'o.ordered_at', 'dt.table_number', 'dt.status as table_status', 'ts.status as table_session_status'])
            ->map(fn ($order) => [...(array) $order, 'items' => DB::table('order_items')->where('order_id', $order->id)
                ->get(['id', 'product_name_snapshot as name', 'variant_name_snapshot as variant', 'quantity', 'notes'])]);

        return response()->json(['orders' => $orders]);
    }

    public function releaseSelfServiceTable(Request $request, string $order): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $order) {
            $row = DB::table('orders as o')->join('table_sessions as ts', 'ts.id', '=', 'o.table_session_id')
                ->join('dining_tables as dt', 'dt.id', '=', 'ts.dining_table_id')->where('o.id', $order)
                ->where('o.outlet_id', $request->user()->outlet_id)->where('o.source', 'self_service')->lockForUpdate()
                ->first(['o.id', 'o.payment_status', 'o.table_session_id', 'dt.id as table_id', 'dt.table_number', 'dt.status as table_status', 'ts.status as session_status']);
            abort_unless($row, 404, 'Pesanan atau meja tidak ditemukan.');
            abort_unless($row->payment_status === 'paid', 409, 'Meja hanya dapat dikosongkan setelah pembayaran lunas.');
            $openBills = DB::table('orders')->where('table_session_id', $row->table_session_id)->whereNotIn('payment_status', ['paid', 'voided'])->exists();
            abort_if($openBills, 409, 'Masih ada tagihan yang belum lunas pada meja ini.');
            if ($row->session_status !== 'closed') {
                DB::table('table_sessions')->where('id', $row->table_session_id)->update(['status' => 'closed', 'closed_at' => now(), 'updated_at' => now()]);
            }
            DB::table('dining_tables')->where('id', $row->table_id)->update(['status' => 'available', 'updated_at' => now()]);

            return $row->table_number;
        }, 3);

        return response()->json(['message' => 'Meja '.$result.' sudah kosong dan tersedia kembali.', 'table_number' => $result]);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in(['open_bill', 'paid', 'voided'])], 'date' => ['nullable', 'date']]);
        $query = DB::table('orders')->where('outlet_id', $request->user()->outlet_id)
            ->whereDate('ordered_at', $data['date'] ?? today())->orderByDesc('ordered_at')->limit(200);
        if (isset($data['status'])) {
            $query->where('payment_status', $data['status']);
        }

        return response()->json(['orders' => $query->get()]);
    }

    public function show(Request $request, string $order): JsonResponse
    {
        $exists = DB::table('orders')->where('id', $order)->where('outlet_id', $request->user()->outlet_id)->exists();
        abort_unless($exists, 404, 'Pesanan tidak ditemukan pada store aktif.');

        return response()->json($this->orderPayload($order));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_order_id' => ['required', 'uuid'], 'idempotency_key' => ['required', 'string', 'min:16', 'max:160'],
            'order_type' => ['required', Rule::in(['dine_in', 'take_away', 'delivery'])],
            'dining_table_id' => ['nullable', 'uuid'],
            'items' => ['required', 'array', 'min:1', 'max:100'], 'items.*.product_id' => ['required', 'string', 'max:100'],
            'items.*.variant_id' => ['nullable', 'uuid'], 'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.notes' => ['nullable', 'string', 'max:500'], 'items.*.add_on_ids' => ['nullable', 'array', 'max:30'],
            'items.*.add_on_ids.*' => ['uuid'], 'items.*.removed_ingredient_ids' => ['nullable', 'array', 'max:30'],
            'items.*.removed_ingredient_ids.*' => ['uuid'], 'discount_total' => ['nullable', 'numeric', 'min:0'],
        ]);
        $outletId = $request->user()->outlet_id;
        if ($data['order_type'] === 'dine_in' && empty($data['dining_table_id'])) {
            throw ValidationException::withMessages(['dining_table_id' => 'Pilih nomor meja yang tersedia untuk pesanan Dine In.']);
        }
        $shiftId = DB::table('pos_shifts')->where('outlet_id', $outletId)->where('cashier_id', $request->user()->id)->where('status', 'open')->value('id');
        abort_unless($shiftId, 409, 'Buka shift kasir sebelum membuat pesanan.');
        $existing = DB::table('orders')->where('outlet_id', $outletId)->where('idempotency_key', $data['idempotency_key'])->first();
        if ($existing) {
            return response()->json($this->orderPayload($existing->id));
        }

        $result = DB::transaction(function () use ($request, $data, $outletId, $shiftId) {
            $tableSessionId = null;
            if ($data['order_type'] === 'dine_in') {
                $table = DB::table('dining_tables')->where('id', $data['dining_table_id'])
                    ->where('outlet_id', $outletId)->whereNull('deleted_at')->lockForUpdate()->first();
                abort_unless($table, 422, 'Meja tidak ditemukan pada outlet ini.');
                abort_unless($table->status === 'available', 409, 'Meja tersebut sudah terisi. Pilih meja kosong lainnya.');
                $tableSessionId = (string) Str::uuid();
                DB::table('table_sessions')->insert([
                    'id' => $tableSessionId, 'outlet_id' => $outletId, 'dining_table_id' => $table->id,
                    'session_number' => 'TBL-'.$table->table_number.'-'.now()->format('ymdHis'),
                    'status' => 'open', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('dining_tables')->where('id', $table->id)->update(['status' => 'occupied', 'updated_at' => now()]);
            }
            $settings = DB::table('outlet_settings')->where('outlet_id', $outletId)->first();
            $stationId = DB::table('kitchen_stations')->where('outlet_id', $outletId)->where('is_active', true)->orderBy('created_at')->value('id');
            $lines = [];
            $subtotal = 0;
            foreach ($data['items'] as $position => $item) {
                $line = $this->priceLine($request, $item);
                $line['position'] = $position + 1;
                $line['station_id'] = $stationId;
                $subtotal += $line['unit_price'] * $line['quantity'];
                $lines[] = $line;
            }
            $requestedDiscount = round((float) ($data['discount_total'] ?? 0), 2);
            $cashierLimit = round($subtotal * 0.10, 2);
            if ($requestedDiscount > $cashierLimit) {
                throw ValidationException::withMessages(['discount_total' => 'Diskon di atas 10% wajib melalui persetujuan manager dan belum dapat diproses oleh akun kasir.']);
            }
            $taxRate = (float) ($settings->tax_rate ?? 11);
            $taxBase = max(0, $subtotal - $requestedDiscount);
            $tax = (bool) ($settings->tax_inclusive ?? false) ? 0 : round($taxBase * $taxRate / 100, 2);
            $service = round($taxBase * (float) ($settings->default_service_charge ?? 0) / 100, 2);
            $grand = max(0, $taxBase + $tax + $service);
            $orderId = (string) Str::uuid();
            $batchId = (string) Str::uuid();
            $number = now()->format('ymd').'-'.strtoupper(substr(str_replace('-', '', $orderId), 0, 8));
            DB::table('orders')->insert([
                'id' => $orderId, 'outlet_id' => $outletId, 'cashier_id' => $request->user()->id, 'shift_id' => $shiftId,
                'table_session_id' => $tableSessionId,
                'order_number' => $number, 'client_order_id' => $data['client_order_id'], 'idempotency_key' => $data['idempotency_key'],
                'order_type' => $data['order_type'], 'source' => 'pos', 'production_status' => 'queued', 'payment_status' => 'open_bill',
                'subtotal' => $subtotal, 'tax_total' => $tax, 'service_total' => $service, 'discount_total' => $requestedDiscount,
                'grand_total' => $grand, 'paid_total' => 0, 'ordered_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('order_batches')->insert(['id' => $batchId, 'order_id' => $orderId, 'batch_number' => $number.'-01', 'sequence' => 1,
                'status' => 'submitted', 'is_additional' => false, 'submitted_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $itemIds = [];
            foreach ($lines as $line) {
                $itemId = (string) Str::uuid();
                $itemIds[] = $itemId;
                DB::table('order_items')->insert(['id' => $itemId, 'order_id' => $orderId, 'order_batch_id' => $batchId,
                    'product_id' => $line['product_id'], 'variant_id' => $line['variant_id'], 'kitchen_station_id' => $stationId,
                    'product_name_snapshot' => $line['name'], 'variant_name_snapshot' => $line['variant_name'], 'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'], 'line_total' => $line['unit_price'] * $line['quantity'],
                    'modifier_snapshot' => json_encode($line['modifiers']), 'notes' => $line['notes'], 'production_status' => 'queued',
                    'created_at' => now(), 'updated_at' => now()]);
            }
            if ($stationId) {
                $ticketId = (string) Str::uuid();
                DB::table('kitchen_tickets')->insert(['id' => $ticketId, 'order_id' => $orderId, 'order_batch_id' => $batchId,
                    'kitchen_station_id' => $stationId, 'ticket_number' => $number, 'status' => 'queued', 'priority' => 0,
                    'queued_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                DB::table('kitchen_ticket_items')->insert(array_map(fn ($id) => ['kitchen_ticket_id' => $ticketId, 'order_item_id' => $id], $itemIds));
            }
            $flags = array_values(array_filter([$requestedDiscount > 0 ? 'DISCOUNT_APPLIED' : null, ! $stationId ? 'NO_KITCHEN_STATION' : null]));
            $this->audit($request, 'order.created', 'order', $orderId, null, ['total' => $grand, 'item_count' => count($lines)], $flags);

            return $orderId;
        }, 3);

        return response()->json($this->orderPayload($result), 201);
    }

    public function pay(Request $request, string $order): JsonResponse
    {
        $data = $request->validate(['idempotency_key' => ['required', 'string', 'min:16', 'max:160'],
            'method' => ['required', Rule::in(['cash', 'qris', 'debit_card', 'e_wallet'])], 'amount' => ['required', 'numeric', 'gt:0'],
            'external_reference' => ['nullable', 'string', 'max:150'], 'cash_received' => ['nullable', 'numeric', 'min:0']]);
        $existing = DB::table('payments')->where('idempotency_key', $data['idempotency_key'])->first();
        if ($existing) {
            return response()->json(['payment' => $existing, 'order' => $this->orderPayload($existing->order_id)]);
        }
        $payment = DB::transaction(function () use ($request, $data, $order) {
            $row = DB::table('orders')->where('id', $order)->where('outlet_id', $request->user()->outlet_id)->lockForUpdate()->first();
            abort_unless($row, 404, 'Pesanan tidak ditemukan.');
            abort_if(in_array($row->payment_status, ['paid', 'voided']), 422, 'Pesanan sudah dibayar atau dibatalkan.');
            $activeShift = DB::table('pos_shifts')->where('id', $row->shift_id)->where('cashier_id', $request->user()->id)->where('status', 'open')->first();
            abort_unless($activeShift, 409, 'Pembayaran hanya dapat dilakukan pada shift aktif pemilik pesanan.');
            $remaining = round((float) $row->grand_total - (float) $row->paid_total, 2);
            abort_if(abs((float) $data['amount'] - $remaining) > 0.009, 422, 'Nominal pembayaran harus sama dengan sisa tagihan.');
            if ($data['method'] === 'cash') {
                abort_if((float) ($data['cash_received'] ?? 0) < $remaining, 422, 'Uang tunai kurang dari total tagihan.');
            }
            if ($data['method'] !== 'cash') {
                abort_unless(filled($data['external_reference'] ?? null), 422, 'Nomor referensi wajib untuk pembayaran non-tunai.');
            }
            $id = (string) Str::uuid();
            $number = 'PAY-'.now()->format('ymdHis').'-'.strtoupper(substr($id, 0, 6));
            DB::table('payments')->insert(['id' => $id, 'order_id' => $row->id, 'shift_id' => $activeShift->id, 'payment_number' => $number, 'method' => $data['method'],
                'external_reference' => $data['external_reference'] ?? null, 'status' => 'paid', 'amount' => $remaining,
                'idempotency_key' => $data['idempotency_key'], 'paid_at' => now(), 'metadata' => json_encode(['cash_received' => $data['cash_received'] ?? null]),
                'created_at' => now(), 'updated_at' => now()]);
            DB::table('orders')->where('id', $row->id)->update(['paid_total' => $remaining, 'payment_status' => 'paid', 'updated_at' => now()]);
            $this->audit($request, 'payment.paid', 'payment', $id, null, ['order_id' => $row->id, 'amount' => $remaining, 'method' => $data['method']], []);

            return DB::table('payments')->where('id', $id)->first();
        }, 3);

        return response()->json(['payment' => $payment, 'order' => $this->orderPayload($order)], 201);
    }

    public function kitchen(Request $request): JsonResponse
    {
        $tickets = DB::table('kitchen_tickets as kt')->join('orders as o', 'o.id', '=', 'kt.order_id')
            ->leftJoin('table_sessions as ts', 'ts.id', '=', 'o.table_session_id')->leftJoin('dining_tables as dt', 'dt.id', '=', 'ts.dining_table_id')
            ->where('o.outlet_id', $request->user()->outlet_id)->whereDate('kt.queued_at', today())->orderBy('kt.queued_at')
            ->get(['kt.*', 'o.order_number', 'o.order_type', 'o.payment_status', 'o.source', 'dt.table_number']);

        return response()->json(['tickets' => $tickets->map(fn ($ticket) => [...(array) $ticket,
            'order_type' => $ticket->table_number ? 'Meja '.$ticket->table_number.($ticket->source === 'self_service' ? ' • Self Service' : '') : $ticket->order_type,
            'items' => DB::table('kitchen_ticket_items as kti')
                ->join('order_items as oi', 'oi.id', '=', 'kti.order_item_id')->where('kti.kitchen_ticket_id', $ticket->id)
                ->get(['oi.id', 'oi.product_name_snapshot as name', 'oi.variant_name_snapshot as variant', 'oi.quantity', 'oi.notes', 'oi.modifier_snapshot', 'oi.production_status'])])]);
    }

    public function kitchenStatus(Request $request, string $ticket): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['preparing', 'ready'])]]);
        $row = DB::table('kitchen_tickets as kt')->join('orders as o', 'o.id', '=', 'kt.order_id')
            ->where('kt.id', $ticket)->where('o.outlet_id', $request->user()->outlet_id)->first(['kt.id', 'kt.order_id', 'kt.status']);
        abort_unless($row, 404);
        $allowed = ['queued' => 'preparing', 'preparing' => 'ready'];
        abort_unless(($allowed[$row->status] ?? null) === $data['status'], 409, 'Perubahan status kitchen tidak valid atau sudah diproses perangkat lain.');
        DB::transaction(function () use ($request, $row, $data) {
            DB::table('kitchen_tickets')->where('id', $row->id)->where('status', $row->status)->update(['status' => $data['status'],
                'ready_at' => $data['status'] === 'ready' ? now() : null, 'updated_at' => now()]);
            DB::table('order_items')->whereIn('id', DB::table('kitchen_ticket_items')->where('kitchen_ticket_id', $row->id)->select('order_item_id'))
                ->update(['production_status' => $data['status'], 'updated_at' => now()]);
            DB::table('orders')->where('id', $row->order_id)->update(['production_status' => $data['status'], 'updated_at' => now()]);
            $this->audit($request, 'kitchen.status_changed', 'kitchen_ticket', $row->id, ['status' => $row->status], ['status' => $data['status']], []);
        });

        return response()->json(['message' => 'Status kitchen diperbarui.', 'status' => $data['status']]);
    }

    private function priceLine(Request $request, array $item): array
    {
        $productId = Str::startsWith($item['product_id'], 'bundle:') ? null : $item['product_id'];
        if (! $productId) {
            $bundleId = Str::after($item['product_id'], 'bundle:');
            $row = DB::table('product_bundles')->where('id', $bundleId)->where('company_id', $request->user()->company_id)
                ->where('is_active', true)->whereNull('deleted_at')->first();
            abort_unless($row, 422, 'Paket tidak tersedia.');
            $price = (float) $row->selling_price;
            $name = $row->name;
            $variant = null;
        } else {
            $row = DB::table('products')->where('id', $productId)->where('company_id', $request->user()->company_id)
                ->where('is_active', true)->whereNull('deleted_at')->first();
            abort_unless($row, 422, 'Produk tidak tersedia.');
            $name = $row->name;
            $variant = null;
            $price = (float) $row->selling_price;
            if (! empty($item['variant_id'])) {
                $variant = DB::table('product_variants')->where('id', $item['variant_id'])->where('product_id', $row->id)->where('is_active', true)->first();
                abort_unless($variant, 422, 'Varian produk tidak valid.');
                $price = (float) ($variant->selling_price ?: $price);
            }
            $promo = DB::table('product_promotions as pp')->join('promotions as p', 'p.id', '=', 'pp.promotion_id')
                ->where('pp.product_id', $row->id)->where('pp.company_id', $request->user()->company_id)->where('p.is_active', true)
                ->whereNull('pp.deleted_at')->whereNull('p.deleted_at')->whereDate('p.effective_from', '<=', today())
                ->where(fn ($q) => $q->whereNull('p.effective_until')->orWhereDate('p.effective_until', '>=', today()))->value('pp.promo_price');
            if ($promo !== null) {
                $price = (float) $promo;
            }
        }
        $addOns = collect();
        if (! empty($item['add_on_ids'])) {
            $addOns = DB::table('add_ons')->whereIn('id', array_unique($item['add_on_ids']))
                ->where('company_id', $request->user()->company_id)->where('is_active', true)->whereNull('deleted_at')->get(['id', 'name', 'price']);
        }
        abort_if($addOns->count() !== count(array_unique($item['add_on_ids'] ?? [])), 422, 'Salah satu add-on tidak valid.');
        $removed = collect();
        if ($productId && ! empty($item['removed_ingredient_ids'])) {
            $removed = DB::table('recipes as r')->join('recipe_items as ri', 'ri.recipe_id', '=', 'r.id')
                ->join('materials as m', 'm.id', '=', 'ri.material_id')->join('ingredient_modifiers as im', 'im.material_id', '=', 'm.id')
                ->where('r.product_id', $productId)->whereIn('m.id', array_unique($item['removed_ingredient_ids']))->where('im.company_id', $request->user()->company_id)
                ->where('im.is_active', true)->whereNull('im.deleted_at')->get(['m.id', 'im.name']);
        }
        abort_if($removed->count() !== count(array_unique($item['removed_ingredient_ids'] ?? [])), 422, 'Modifier ingredient tidak valid.');

        return ['product_id' => $productId, 'variant_id' => $variant?->id, 'variant_name' => $variant?->name, 'name' => $name,
            'quantity' => (int) $item['quantity'], 'unit_price' => round($price + $addOns->sum('price'), 2), 'notes' => $item['notes'] ?? null,
            'modifiers' => ['add_ons' => $addOns, 'removed_ingredients' => $removed]];
    }

    private function orderPayload(string $id): array
    {
        $order = DB::table('orders')->where('id', $id)->first();

        return ['order' => $order, 'items' => DB::table('order_items')->where('order_id', $id)->orderBy('created_at')->get(),
            'payments' => DB::table('payments')->where('order_id', $id)->orderBy('created_at')->get()];
    }

    private function audit(Request $request, string $event, string $type, ?string $id, mixed $before, mixed $after, array $flags): void
    {
        DB::table('pos_audit_logs')->insert(['company_id' => $request->user()->company_id, 'outlet_id' => $request->user()->outlet_id,
            'actor_id' => $request->user()->id, 'event' => $event, 'entity_type' => $type, 'entity_id' => $id,
            'request_id' => $request->header('X-Request-ID'), 'ip_address' => $request->ip(), 'before_data' => $before ? json_encode($before) : null,
            'after_data' => $after ? json_encode($after) : null, 'risk_flags' => $flags ? json_encode($flags) : null, 'created_at' => now(), 'updated_at' => now()]);
    }
}
