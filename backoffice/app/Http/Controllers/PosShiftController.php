<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PosShiftController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $registers = DB::table('pos_registers')->where('outlet_id', $request->user()->outlet_id)->where('is_active', true)->orderBy('code')->get();
        $shift = DB::table('pos_shifts as s')->join('pos_registers as r', 'r.id', '=', 's.register_id')
            ->where('s.outlet_id', $request->user()->outlet_id)->where('s.cashier_id', $request->user()->id)->where('s.status', 'open')
            ->orderByDesc('s.opened_at')->first(['s.*', 'r.code as register_code', 'r.name as register_name']);
        return response()->json(['shift' => $shift, 'registers' => $registers]);
    }

    public function open(Request $request): JsonResponse
    {
        $data = $request->validate(['register_id' => ['required', 'uuid'], 'opening_cash' => ['required', 'numeric', 'min:0', 'max:999999999']]);
        $shift = DB::transaction(function () use ($request, $data) {
            $current = DB::table('pos_shifts')->where('cashier_id', $request->user()->id)->where('status', 'open')->lockForUpdate()->first();
            abort_if($current, 409, 'Kasir masih mempunyai shift aktif. Tutup shift tersebut terlebih dahulu.');
            $register = DB::table('pos_registers')->where('id', $data['register_id'])->where('outlet_id', $request->user()->outlet_id)
                ->where('is_active', true)->lockForUpdate()->first();
            abort_unless($register, 422, 'Register tidak tersedia pada cabang ini.');
            $occupied = DB::table('pos_shifts')->where('register_id', $register->id)->where('status', 'open')->exists();
            abort_if($occupied, 409, 'Register sedang digunakan oleh kasir lain.');
            $id = (string) Str::uuid(); $number = 'SHIFT-'.now()->format('Ymd-His').'-'.strtoupper(substr($id, 0, 5));
            DB::table('pos_shifts')->insert(['id' => $id, 'outlet_id' => $request->user()->outlet_id, 'register_id' => $register->id,
                'cashier_id' => $request->user()->id, 'shift_number' => $number, 'status' => 'open', 'opening_cash' => round((float) $data['opening_cash'], 2),
                'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $this->audit($request, 'shift.opened', $id, ['register' => $register->code, 'opening_cash' => $data['opening_cash']]);
            return $id;
        }, 3);
        return response()->json(['shift' => $this->summary($shift)], 201);
    }

    public function close(Request $request, string $shift): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);
        $result = DB::transaction(function () use ($request, $data, $shift) {
            $row = DB::table('pos_shifts')->where('id', $shift)->where('outlet_id', $request->user()->outlet_id)
                ->where('cashier_id', $request->user()->id)->where('status', 'open')->lockForUpdate()->first();
            abort_unless($row, 404, 'Shift aktif tidak ditemukan atau sudah ditutup.');
            $pending = DB::table('orders')->where('shift_id', $row->id)->where('payment_status', 'open_bill')->count();
            abort_if($pending > 0, 422, "Masih ada {$pending} pesanan belum lunas. Selesaikan atau pindahkan pesanan sebelum tutup shift.");
            $cashSales = (float) DB::table('payments')->where('shift_id', $row->id)->where('status', 'paid')->where('method', 'cash')->sum('amount');
            $expected = round((float) $row->opening_cash + $cashSales, 2); $actual = $expected;
            DB::table('pos_shifts')->where('id', $row->id)->update(['status' => 'closed', 'expected_cash' => $expected,
                'actual_cash' => $actual, 'cash_variance' => $actual - $expected, 'closing_note' => $data['note'] ?? null,
                'closed_at' => now(), 'closed_by' => $request->user()->id, 'updated_at' => now()]);
            $this->audit($request, 'shift.closed', $row->id, ['expected_cash' => $expected, 'actual_cash' => $actual, 'variance' => $actual - $expected]);
            return $this->summary($row->id);
        }, 3);
        return response()->json(['shift' => $result]);
    }

    public function show(Request $request, string $shift): JsonResponse
    {
        $exists = DB::table('pos_shifts')->where('id', $shift)->where('outlet_id', $request->user()->outlet_id)
            ->where('cashier_id', $request->user()->id)->exists();
        abort_unless($exists, 404); return response()->json(['shift' => $this->summary($shift)]);
    }

    private function summary(string $shift): array
    {
        $row = DB::table('pos_shifts as s')->join('pos_registers as r', 'r.id', '=', 's.register_id')->join('users as u', 'u.id', '=', 's.cashier_id')
            ->where('s.id', $shift)->first(['s.*', 'r.code as register_code', 'r.name as register_name', 'u.name as cashier_name']);
        $methods = DB::table('payments')->where('shift_id', $shift)->where('status', 'paid')->select('method', DB::raw('count(*) transaction_count'), DB::raw('sum(amount) total'))
            ->groupBy('method')->orderBy('method')->get()->map(fn ($item) => ['method' => $item->method, 'transaction_count' => (int) $item->transaction_count, 'total' => (float) $item->total]);
        $orders = DB::table('orders')->where('shift_id', $shift)->selectRaw('count(*) total_orders, coalesce(sum(grand_total),0) gross_sales, coalesce(sum(discount_total),0) discount_total, coalesce(sum(tax_total),0) tax_total')->first();
        $orderTypes = DB::table('orders')->where('shift_id', $shift)->select('order_type', DB::raw('count(*) transaction_count'), DB::raw('coalesce(sum(grand_total),0) total'))
            ->groupBy('order_type')->orderBy('order_type')->get()->map(fn ($item) => ['order_type' => $item->order_type,
                'transaction_count' => (int) $item->transaction_count, 'total' => (float) $item->total]);
        return [...(array) $row, 'payment_summary' => $methods, 'total_orders' => (int) $orders->total_orders,
            'gross_sales' => (float) $orders->gross_sales, 'discount_total' => (float) $orders->discount_total, 'tax_total' => (float) $orders->tax_total,
            'paid_total' => (float) $methods->sum('total'), 'order_type_summary' => $orderTypes];
    }

    private function audit(Request $request, string $event, string $id, array $after): void
    {
        DB::table('pos_audit_logs')->insert(['company_id' => $request->user()->company_id, 'outlet_id' => $request->user()->outlet_id,
            'actor_id' => $request->user()->id, 'event' => $event, 'entity_type' => 'pos_shift', 'entity_id' => $id,
            'ip_address' => $request->ip(), 'after_data' => json_encode($after), 'created_at' => now(), 'updated_at' => now()]);
    }
}
