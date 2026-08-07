<?php

namespace App\Http\Controllers\CustomerOrder;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class CustomerOrderController extends Controller
{
    public function catalog(string $token): JsonResponse
    {
        $table = $this->tableByToken($token);
        $products = DB::table('products as p')->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->where('p.company_id', $table->company_id)->where('p.is_active', true)->where('p.product_type', 'menu')
            ->whereNull('p.deleted_at')->orderBy('c.name')->orderBy('p.name')
            ->get(['p.id', 'p.sku', 'p.name', 'p.image_path', 'p.selling_price', 'c.name as category'])
            ->map(function ($product) {
                $variants = DB::table('product_variants')->where('product_id', $product->id)->where('is_active', true)
                    ->orderByRaw("CASE name WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 ELSE 4 END")
                    ->get(['id', 'name', 'sku', 'selling_price'])->map(fn ($variant) => [
                        'id' => $variant->id, 'name' => $variant->name, 'sku' => $variant->sku,
                        'price' => (float) ($variant->selling_price ?: $product->selling_price),
                    ]);

                return ['id' => $product->id, 'sku' => $product->sku, 'name' => $product->name, 'category' => $product->category ?: 'Lainnya',
                    'price' => (float) $product->selling_price, 'image_url' => $product->image_path ? asset('storage/'.$product->image_path) : null,
                    'variants' => $variants];
            });
        $addOns = DB::table('add_ons')->where('company_id', $table->company_id)->where('is_active', true)->whereNull('deleted_at')
            ->orderBy('name')->get(['id', 'name', 'price'])->map(fn ($item) => [...(array) $item, 'price' => (float) $item->price]);

        return response()->json(['outlet' => ['id' => $table->outlet_id, 'name' => $table->outlet_name, 'code' => $table->outlet_code],
            'table' => ['id' => $table->id, 'number' => $table->table_number, 'name' => $table->name, 'status' => $table->status],
            'categories' => $products->pluck('category')->unique()->values(), 'products' => $products, 'add_ons' => $addOns]);
    }

    public function store(Request $request, string $token): JsonResponse
    {
        $table = $this->tableByToken($token);
        $data = $request->validate(['customer_name' => ['nullable', 'string', 'max:80'], 'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'uuid'], 'items.*.variant_id' => ['nullable', 'uuid'], 'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.add_on_ids' => ['nullable', 'array', 'max:20'], 'items.*.add_on_ids.*' => ['uuid'], 'items.*.notes' => ['nullable', 'string', 'max:300']]);
        $accessToken = Str::random(64);
        $orderId = DB::transaction(function () use ($data, $table, $accessToken) {
            $lockedTable = DB::table('dining_tables')->where('id', $table->id)->lockForUpdate()->first();
            abort_if($lockedTable->status === 'inactive', 422, 'Meja sedang tidak aktif.');
            $session = DB::table('table_sessions')->where('dining_table_id', $table->id)->where('status', 'open')->lockForUpdate()->first();
            if (! $session) {
                $sessionId = (string) Str::uuid();
                DB::table('table_sessions')->insert(['id' => $sessionId, 'outlet_id' => $table->outlet_id, 'dining_table_id' => $table->id,
                    'session_number' => 'SELF-'.$table->table_number.'-'.now()->format('ymdHis'), 'status' => 'open', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                $session = (object) ['id' => $sessionId];
            }
            $orderId = (string) Str::uuid();
            $batchId = (string) Str::uuid();
            $subtotal = 0;
            $lines = [];
            foreach ($data['items'] as $item) {
                $product = DB::table('products')->where('id', $item['product_id'])->where('company_id', $table->company_id)
                    ->where('is_active', true)->whereNull('deleted_at')->first();
                abort_unless($product, 422, 'Salah satu menu tidak tersedia.');
                $price = (float) $product->selling_price;
                $variantName = null;
                if (! empty($item['variant_id'])) {
                    $variant = DB::table('product_variants')->where('id', $item['variant_id'])->where('product_id', $product->id)->where('is_active', true)->first();
                    abort_unless($variant, 422, 'Ukuran menu tidak valid.');
                    $variantName = $variant->name;
                    $price = (float) ($variant->selling_price ?: $price);
                }
                $addOns = DB::table('add_ons')->whereIn('id', array_unique($item['add_on_ids'] ?? []))->where('company_id', $table->company_id)
                    ->where('is_active', true)->whereNull('deleted_at')->get(['id', 'name', 'price']);
                abort_if($addOns->count() !== count(array_unique($item['add_on_ids'] ?? [])), 422, 'Add-on tidak valid.');
                $unitPrice = $price + (float) $addOns->sum('price');
                $subtotal += $unitPrice * $item['quantity'];
                $lines[] = ['product' => $product, 'variant_id' => $item['variant_id'] ?? null, 'variant_name' => $variantName, 'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice, 'notes' => $item['notes'] ?? null, 'add_ons' => $addOns];
            }
            $settings = DB::table('outlet_settings')->where('outlet_id', $table->outlet_id)->first();
            $tax = round($subtotal * (float) ($settings->tax_rate ?? 11) / 100, 2);
            $total = $subtotal + $tax;
            $number = 'SELF-'.now()->format('ymd').'-'.strtoupper(substr(str_replace('-', '', $orderId), 0, 6));
            DB::table('orders')->insert(['id' => $orderId, 'outlet_id' => $table->outlet_id, 'table_session_id' => $session->id, 'order_number' => $number,
                'client_order_id' => $orderId, 'idempotency_key' => 'customer:'.$orderId, 'customer_token_hash' => hash('sha256', $accessToken),
                'order_type' => 'dine_in', 'source' => 'self_service', 'production_status' => 'draft', 'payment_status' => 'open_bill', 'subtotal' => $subtotal,
                'tax_total' => $tax, 'service_total' => 0, 'discount_total' => 0, 'grand_total' => $total, 'paid_total' => 0, 'ordered_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('order_batches')->insert(['id' => $batchId, 'order_id' => $orderId, 'batch_number' => $number.'-01', 'sequence' => 1, 'status' => 'draft', 'is_additional' => false, 'created_at' => now(), 'updated_at' => now()]);
            foreach ($lines as $line) {
                DB::table('order_items')->insert(['id' => (string) Str::uuid(), 'order_id' => $orderId, 'order_batch_id' => $batchId,
                    'product_id' => $line['product']->id, 'variant_id' => $line['variant_id'], 'product_name_snapshot' => $line['product']->name,
                    'variant_name_snapshot' => $line['variant_name'], 'quantity' => $line['quantity'], 'unit_price' => $line['unit_price'],
                    'line_total' => $line['unit_price'] * $line['quantity'], 'modifier_snapshot' => json_encode(['add_ons' => $line['add_ons']]),
                    'notes' => $line['notes'], 'production_status' => 'draft', 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('dining_tables')->where('id', $table->id)->update(['status' => 'occupied', 'updated_at' => now()]);

            return $orderId;
        });

        return response()->json(['message' => 'Pesanan dibuat. Lanjutkan pembayaran.', 'access_token' => $accessToken, ...$this->payload($orderId)], 201);
    }

    public function createMidtrans(Request $request, string $order): JsonResponse
    {
        $data = $request->validate(['access_token' => ['required', 'string', 'size:64']]);
        $row = $this->customerOrder($order, $data['access_token']);
        if ($row->payment_status === 'paid') {
            return response()->json(['already_paid' => true, ...$this->payload($row->id)]);
        }

        if (config('services.midtrans.local_simulator') && ! config('services.midtrans.server_key')) {
            return response()->json(['local_simulator' => true, 'simulator_name' => 'POSphere Payment Simulator',
                'notice' => 'Simulator lokal development, bukan layanan resmi Midtrans.']);
        }

        abort_if(! config('services.midtrans.server_key') || ! config('services.midtrans.client_key'), 503, 'API Key Midtrans Sandbox belum diisi pada file .env backend.');

        $response = Http::withBasicAuth((string) config('services.midtrans.server_key'), '')
            ->acceptJson()->post($this->midtransSnapUrl(), [
                'transaction_details' => ['order_id' => $row->order_number, 'gross_amount' => (int) round($row->grand_total)],
                'item_details' => [['id' => $row->id, 'price' => (int) round($row->grand_total), 'quantity' => 1, 'name' => 'Pesanan '.$row->order_number]],
                'customer_details' => ['first_name' => 'Customer Meja'],
                'callbacks' => ['finish' => rtrim((string) config('services.customer_app_url'), '/').'/payment/finish'],
            ]);

        abort_unless($response->successful() && $response->json('token'), 502, $response->json('error_messages.0') ?: 'Midtrans Sandbox tidak dapat membuat transaksi.');

        return response()->json(['snap_token' => $response->json('token'), 'redirect_url' => $response->json('redirect_url'),
            'client_key' => config('services.midtrans.client_key'), 'snap_url' => $this->midtransSnapJsUrl()]);
    }

    public function verifyMidtrans(Request $request, string $order): JsonResponse
    {
        $data = $request->validate(['access_token' => ['required', 'string', 'size:64']]);
        $row = $this->customerOrder($order, $data['access_token']);
        $response = Http::withBasicAuth((string) config('services.midtrans.server_key'), '')
            ->acceptJson()->get($this->midtransStatusUrl($row->order_number));
        abort_unless($response->successful(), 409, 'Status pembayaran Midtrans belum tersedia.');
        $paid = $this->completePaidOrder($row->id, $response->json());
        abort_unless($paid, 409, 'Pembayaran belum selesai. Selesaikan pembayaran pada simulator Midtrans.');

        return response()->json(['message' => 'Pembayaran Midtrans berhasil. Pesanan sudah masuk kitchen.', ...$this->payload($row->id)]);
    }

    public function simulateMidtrans(Request $request, string $order): JsonResponse
    {
        abort_unless(app()->environment('local') && config('services.midtrans.local_simulator'), 404);
        $data = $request->validate(['access_token' => ['required', 'string', 'size:64'], 'result' => ['required', 'in:success,pending,failed'],
            'payment_method' => ['required', 'in:qris,gopay,bank_transfer,cstore,cardless_credit,credit_card']]);
        $row = $this->customerOrder($order, $data['access_token']);
        if ($data['result'] !== 'success') {
            return response()->json(['status' => $data['result'], 'message' => $data['result'] === 'pending'
                ? 'Transaksi simulator masih menunggu pembayaran.' : 'Transaksi simulator gagal atau ditolak.'], 409);
        }

        $this->completePaidOrder($row->id, ['transaction_status' => 'settlement', 'fraud_status' => 'accept',
            'status_code' => '200', 'gross_amount' => number_format((float) $row->grand_total, 2, '.', ''),
            'payment_type' => $data['payment_method'], 'transaction_id' => 'LOCAL-'.strtoupper(Str::random(16)),
            'order_id' => $row->order_number, 'simulator' => true]);

        return response()->json(['message' => 'Pembayaran simulator berhasil. Pesanan sudah masuk kitchen.', ...$this->payload($row->id)]);
    }

    public function midtransNotification(Request $request): JsonResponse
    {
        $data = $request->all();
        $expected = hash('sha512', ($data['order_id'] ?? '').($data['status_code'] ?? '').($data['gross_amount'] ?? '').config('services.midtrans.server_key'));
        abort_unless(isset($data['signature_key']) && hash_equals($expected, $data['signature_key']), 403, 'Signature Midtrans tidak valid.');
        $row = DB::table('orders')->where('order_number', $data['order_id'])->where('source', 'self_service')->first();
        abort_unless($row, 404);
        $this->completePaidOrder($row->id, $data);

        return response()->json(['message' => 'OK']);
    }

    public function show(Request $request, string $order): JsonResponse
    {
        $token = (string) $request->query('access_token');
        $row = DB::table('orders')->where('id', $order)->where('source', 'self_service')->first();
        abort_unless($row && $token && hash_equals((string) $row->customer_token_hash, hash('sha256', $token)), 404);

        return response()->json($this->payload($order));
    }

    private function customerOrder(string $order, string $accessToken): object
    {
        $row = DB::table('orders')->where('id', $order)->where('source', 'self_service')->first();
        abort_unless($row && hash_equals((string) $row->customer_token_hash, hash('sha256', $accessToken)), 404);

        return $row;
    }

    private function completePaidOrder(string $orderId, array $midtrans): bool
    {
        $status = (string) ($midtrans['transaction_status'] ?? '');
        $fraud = (string) ($midtrans['fraud_status'] ?? 'accept');
        if (! in_array($status, ['settlement', 'capture'], true) || $fraud !== 'accept') {
            return false;
        }

        return DB::transaction(function () use ($orderId, $midtrans) {
            $row = DB::table('orders')->where('id', $orderId)->where('source', 'self_service')->lockForUpdate()->first();
            abort_unless($row, 404);
            if ($row->payment_status === 'paid') {
                return true;
            }
            abort_unless(abs((float) $row->grand_total - (float) ($midtrans['gross_amount'] ?? 0)) < 0.01, 422, 'Nominal pembayaran Midtrans tidak sesuai.');

            $paymentId = (string) Str::uuid();
            DB::table('payments')->insert(['id' => $paymentId, 'order_id' => $row->id, 'payment_number' => 'MID-'.strtoupper(substr(str_replace('-', '', $paymentId), 0, 16)),
                'method' => (string) ($midtrans['payment_type'] ?? 'midtrans'), 'provider' => ! empty($midtrans['simulator']) ? 'local_simulator' : 'midtrans', 'external_reference' => $midtrans['transaction_id'] ?? null,
                'status' => 'paid', 'amount' => $row->grand_total, 'idempotency_key' => 'midtrans:'.$row->order_number,
                'paid_at' => now(), 'metadata' => json_encode($midtrans), 'created_at' => now(), 'updated_at' => now()]);
            $stationId = DB::table('kitchen_stations')->where('outlet_id', $row->outlet_id)->where('is_active', true)->whereNull('deleted_at')->value('id');
            if (! $stationId) {
                $stationId = (string) Str::uuid();
                DB::table('kitchen_stations')->insert(['id' => $stationId, 'outlet_id' => $row->outlet_id, 'code' => 'KST-0001', 'name' => 'Kitchen Utama',
                    'sla_minutes' => 15, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
            }
            $batch = DB::table('order_batches')->where('order_id', $row->id)->first();
            DB::table('orders')->where('id', $row->id)->update(['paid_total' => $row->grand_total, 'payment_status' => 'paid', 'production_status' => 'queued', 'updated_at' => now()]);
            DB::table('order_batches')->where('id', $batch->id)->update(['status' => 'submitted', 'submitted_at' => now(), 'updated_at' => now()]);
            DB::table('order_items')->where('order_id', $row->id)->update(['kitchen_station_id' => $stationId, 'production_status' => 'queued', 'updated_at' => now()]);
            if (! DB::table('kitchen_tickets')->where('order_id', $row->id)->exists()) {
                $ticketId = (string) Str::uuid();
                DB::table('kitchen_tickets')->insert(['id' => $ticketId, 'order_id' => $row->id, 'order_batch_id' => $batch->id, 'kitchen_station_id' => $stationId,
                    'ticket_number' => $row->order_number, 'status' => 'queued', 'priority' => 0, 'queued_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                $items = DB::table('order_items')->where('order_id', $row->id)->pluck('id');
                DB::table('kitchen_ticket_items')->insert($items->map(fn ($id) => ['kitchen_ticket_id' => $ticketId, 'order_item_id' => $id])->all());
            }

            return true;
        }, 3);
    }

    private function midtransSnapUrl(): string
    {
        return config('services.midtrans.is_production') ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
    }

    private function midtransSnapJsUrl(): string
    {
        return config('services.midtrans.is_production') ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
    }

    private function midtransStatusUrl(string $orderNumber): string
    {
        $base = config('services.midtrans.is_production') ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

        return $base.'/v2/'.rawurlencode($orderNumber).'/status';
    }

    private function tableByToken(string $token): object
    {
        $table = DB::table('table_qr_codes as qr')->join('dining_tables as dt', 'dt.id', '=', 'qr.dining_table_id')->join('outlets as o', 'o.id', '=', 'dt.outlet_id')
            ->where('qr.token_hash', hash('sha256', $token))->where('qr.is_active', true)->whereNull('dt.deleted_at')->whereNull('o.deleted_at')
            ->first(['dt.id', 'dt.table_number', 'dt.name', 'dt.status', 'dt.outlet_id', 'o.name as outlet_name', 'o.code as outlet_code', 'o.company_id']);
        abort_unless($table, 404, 'QR meja tidak valid.');

        return $table;
    }

    private function payload(string $orderId): array
    {
        $order = DB::table('orders as o')->leftJoin('table_sessions as ts', 'ts.id', '=', 'o.table_session_id')->leftJoin('dining_tables as dt', 'dt.id', '=', 'ts.dining_table_id')
            ->where('o.id', $orderId)->first(['o.id', 'o.order_number', 'o.payment_status', 'o.production_status', 'o.subtotal', 'o.tax_total', 'o.grand_total', 'o.ordered_at', 'dt.table_number']);

        return ['order' => $order, 'items' => DB::table('order_items')->where('order_id', $orderId)->orderBy('created_at')->get(),
            'payment' => DB::table('payments')->where('order_id', $orderId)->where('status', 'paid')->latest('paid_at')->first(['method', 'provider', 'paid_at'])];
    }
}
