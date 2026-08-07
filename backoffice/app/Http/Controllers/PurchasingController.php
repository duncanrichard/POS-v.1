<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchasingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $outletId = $this->filterOutletId($request);
        return response()->json(
            DB::table('purchase_orders as po')
                ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
                ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
                ->leftJoinSub(DB::table('purchase_order_items')->selectRaw('purchase_order_id, count(*) as item_count')->groupBy('purchase_order_id'), 'pic', 'pic.purchase_order_id', '=', 'po.id')
                ->when($outletId, fn ($query) => $query->where('po.outlet_id', $outletId),
                    fn ($query) => $query->whereIn('po.outlet_id', DB::table('outlets')->where('company_id', $request->user()->company_id)->select('id')))
                ->when($request->query('status'), fn ($query, $status) => $query->where('po.status', $status))
                ->orderByDesc('po.created_at')
                ->select('po.*', DB::raw("coalesce(s.name, 'Menunggu penentuan pusat') as supplier_name"), 'o.name as outlet_name', DB::raw('coalesce(pic.item_count, 0) as item_count'))
                ->get()
        );
    }

    public function options(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $outletId = $this->outletId($request);
        return response()->json([
            'categories' => DB::table('material_categories')->where('company_id', $companyId)->whereNull('deleted_at')
                ->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'items' => DB::table('materials as m')->join('units as u', 'u.id', '=', 'm.base_unit_id')
                ->leftJoin('material_categories as c', 'c.id', '=', 'm.material_category_id')
                ->where('m.company_id', $companyId)->whereNull('m.deleted_at')
                ->where('m.is_active', true)->orderBy('m.name')
                ->get(['m.id', 'm.name', 'm.sku', 'm.average_cost', 'm.base_unit_id as unit_id',
                    'm.material_category_id as item_category_id', 'u.code as unit_code', 'c.name as category_name']),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $outletId = $this->filterOutletId($request);
        $order = DB::table('purchase_orders as po')->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('po.id', $id)
            ->when($outletId, fn ($query) => $query->where('po.outlet_id', $outletId),
                fn ($query) => $query->where('o.company_id', $request->user()->company_id))
            ->select('po.*', 's.name as supplier_name', 's.phone as supplier_phone', 's.email as supplier_email',
                'o.name as outlet_name', 'o.address as outlet_address')->first();
        abort_unless($order, 404);
        $items = DB::table('purchase_order_items as poi')->join('materials as m', 'm.id', '=', 'poi.material_id')
            ->join('units as u', 'u.id', '=', 'poi.unit_id')->leftJoin('material_categories as c', 'c.id', '=', 'm.material_category_id')
            ->where('poi.purchase_order_id', $id)
            ->get(['poi.*', 'm.sku', 'm.name as item_name', 'u.code as unit_code', 'c.name as category_name']);
        return response()->json([...((array) $order), 'items' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $outletId = $this->outletId($request);
        $data = $request->validate([
            'expected_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.material_id' => ['required', 'distinct', Rule::exists('materials', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'items.*.item_category_id' => ['required', Rule::exists('material_categories', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'exists:units,id'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);
        foreach ($data['items'] as $index => $item) {
            $validCategory = DB::table('materials')->where('id', $item['material_id'])
                ->where('company_id', $companyId)->whereNull('deleted_at')
                ->where('material_category_id', $item['item_category_id'])->exists();
            if (!$validCategory) {
                throw ValidationException::withMessages([
                    "items.$index.item_category_id" => 'Barang tidak sesuai dengan kategori yang dipilih.',
                ]);
            }
        }

        $id = (string) Str::uuid();
        $number = 'PO-'.now()->format('Ymd').'-'.str_pad((string) (DB::table('purchase_orders')->whereDate('created_at', today())->count() + 1), 4, '0', STR_PAD_LEFT);
        $invoiceNumber = 'INV-PO-'.now()->format('Ymd').'-'.str_pad((string) (DB::table('purchase_orders')->whereDate('created_at', today())->count() + 1), 4, '0', STR_PAD_LEFT);
        $total = collect($data['items'])->sum(fn ($item) => $item['quantity'] * $item['unit_cost']);

        DB::transaction(function () use ($request, $id, $outletId, $number, $invoiceNumber, $data, $total) {
            DB::table('purchase_orders')->insert([
                'id' => $id, 'outlet_id' => $outletId, 'supplier_id' => null,
                'po_number' => $number, 'invoice_number' => $invoiceNumber, 'status' => 'draft', 'grand_total' => $total,
                'created_by' => $request->user()->id,
                'expected_date' => $data['expected_date'] ?? null, 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($data['items'] as $item) {
                DB::table('purchase_order_items')->insert([
                    'id' => (string) Str::uuid(), 'purchase_order_id' => $id, 'product_id' => null,
                    'material_id' => $item['material_id'], 'item_category_id' => null,
                    'unit_id' => $item['unit_id'], 'ordered_qty' => $item['quantity'], 'received_qty' => 0,
                    'unit_cost' => $item['unit_cost'], 'line_total' => $item['quantity'] * $item['unit_cost'],
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $this->notifyOrder($id, 'Order cabang baru', $number.' baru saja dibuat dan menunggu diajukan ke pusat.');
        });

        return response()->json(['message' => 'Purchase order dan invoice berhasil dibuat.', 'id' => $id,
            'po_number' => $number, 'invoice_number' => $invoiceNumber], 201);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $updated = DB::table('purchase_orders')->where('id', $id)->where('outlet_id', $this->outletId($request))
            ->where('status', 'draft')->update(['status' => 'submitted', 'submitted_by' => $request->user()->id, 'updated_at' => now()]);
        abort_unless($updated, 422, 'Hanya PO draft yang dapat diajukan.');
        $po = DB::table('purchase_orders')->where('id', $id)->first();
        $this->notifyOrder($id, 'Permintaan order masuk', $po->po_number.' telah diajukan oleh cabang dan menunggu proses pusat.');
        return response()->json(['message' => 'PO berhasil diajukan untuk persetujuan.']);
    }

    public function notifications(Request $request): JsonResponse
    {
        $rows = DB::table('purchase_order_notifications as n')
            ->join('purchase_orders as po', 'po.id', '=', 'n.purchase_order_id')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('n.company_id', $request->user()->company_id)
            ->whereNull('n.read_at')
            ->orderByDesc('n.created_at')->limit(20)
            ->get(['n.*', 'po.po_number', 'po.status', 'o.name as outlet_name']);
        $pending = DB::table('purchase_orders as po')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('o.company_id', $request->user()->company_id)
            ->where('po.status', 'submitted')
            ->whereNull('po.deleted_at')
            ->count();

        return response()->json([
            'unread' => $rows->count(),
            'pending' => $pending,
            'items' => $rows,
        ]);
    }

    public function decision(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $companyId = $request->user()->company_id;
        $order = DB::table('purchase_orders as po')
            ->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('po.id', $id)
            ->where('o.company_id', $companyId)
            ->where('po.status', 'submitted')
            ->select('po.id', 'po.po_number', 'po.created_by', 'po.submitted_by')
            ->first();
        abort_unless($order, 422, 'Permintaan sudah diproses atau tidak ditemukan.');
        abort_if(in_array($request->user()->id, array_filter([$order->created_by, $order->submitted_by])), 403,
            'Maker-checker aktif: pembuat atau pengaju PO tidak boleh menyetujui PO yang sama.');

        $status = $data['decision'] === 'approve' ? 'approved' : 'rejected';
        DB::table('purchase_orders')->where('id', $id)->update([
            'status' => $status,
            'decided_by' => $request->user()->id,
            'decision_note' => $data['note'] ?? null,
            'updated_at' => now(),
        ]);
        $label = $status === 'approved' ? 'disetujui' : 'ditolak';
        $message = $order->po_number.' telah '.$label.' oleh Brand Operation.';
        if (! empty($data['note'])) {
            $message .= ' Catatan: '.$data['note'];
        }
        $this->notifyOrder($id, 'Permintaan '.$label, $message);

        return response()->json(['message' => 'Permintaan berhasil '.$label.'.']);
    }

    public function readNotifications(Request $request): JsonResponse
    {
        DB::table('purchase_order_notifications')->where('company_id', $request->user()->company_id)
            ->whereNull('read_at')->update(['read_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Notifikasi telah dibaca.']);
    }

    public function readNotification(Request $request, string $id): JsonResponse
    {
        $updated = DB::table('purchase_order_notifications')
            ->where('id', $id)
            ->where('company_id', $request->user()->company_id)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return response()->json([
            'message' => $updated
                ? 'Notifikasi telah dibaca.'
                : 'Notifikasi sudah dibaca.',
        ]);
    }

    private function notifyOrder(string $purchaseOrderId, string $title, string $message): void
    {
        $companyId = DB::table('purchase_orders as po')->join('outlets as o', 'o.id', '=', 'po.outlet_id')
            ->where('po.id', $purchaseOrderId)->value('o.company_id');
        DB::table('purchase_order_notifications')->insert([
            'id' => (string) Str::uuid(), 'company_id' => $companyId,
            'purchase_order_id' => $purchaseOrderId, 'title' => $title, 'message' => $message,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function outletId(Request $request): string
    {
        $id = $request->input('outlet_id', $request->query('outlet_id', $request->user()->outlet_id));
        abort_unless($id, 422, 'Pilih store terlebih dahulu.');
        abort_unless(DB::table('outlets')->where('id', $id)->where('company_id', $request->user()->company_id)->exists(), 403);
        return $id;
    }

    private function filterOutletId(Request $request): ?string
    {
        $id = $request->query('outlet_id', $request->user()->outlet_id);
        if ($id) {
            abort_unless(DB::table('outlets')->where('id', $id)
                ->where('company_id', $request->user()->company_id)->exists(), 403);
        }
        return $id;
    }
}
