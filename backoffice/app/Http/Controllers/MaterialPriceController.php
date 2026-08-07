<?php

namespace App\Http\Controllers;

use App\Support\SoftDeleteAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MaterialPriceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        DB::table('material_prices')->where('company_id', $companyId)->whereNull('deleted_at')
            ->distinct()->pluck('material_id')->each(fn ($id) => $this->syncCurrentPrice($id));

        return response()->json(DB::table('material_prices as mp')
            ->join('materials as m', 'm.id', '=', 'mp.material_id')
            ->leftJoin('units as u', 'u.id', '=', 'm.base_unit_id')
            ->where('mp.company_id', $companyId)->whereNull('mp.deleted_at')->whereNull('m.deleted_at')
            ->orderBy('m.name')->orderByDesc('mp.effective_from')
            ->get(['mp.*', 'm.name as material_name', 'u.name as unit_name'])
            ->map(function ($row) {
                $today = today()->toDateString();
                $row->price_status = $row->effective_from > $today ? 'soon'
                    : ($row->effective_until && $row->effective_until < $today ? 'expired' : 'active');
                return $row;
            }));
    }

    public function options(Request $request): JsonResponse
    {
        return response()->json(DB::table('materials as m')->leftJoin('units as u', 'u.id', '=', 'm.base_unit_id')
            ->where('m.company_id', $request->user()->company_id)->whereNull('m.deleted_at')->where('m.is_active', true)
            ->orderBy('m.name')->get(['m.id', 'm.name', 'm.average_cost as current_price', 'u.name as unit_name']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $this->assertPeriodAvailable($data['material_id'], $data['effective_from'], $data['effective_until'] ?? null);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($request, $data, $id) {
            DB::table('material_prices')->insert([
                'id' => $id, 'company_id' => $request->user()->company_id, 'material_id' => $data['material_id'],
                'price' => $data['price'], 'effective_from' => $data['effective_from'],
                'effective_until' => $data['effective_until'] ?? null, 'created_by' => $request->user()->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->snapshot($request, $id, $data, 'created');
            $this->syncCurrentPrice($data['material_id']);
        });
        return response()->json(['message' => 'Harga bahan berhasil disimpan.', 'id' => $id], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = DB::table('material_prices')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->first();
        abort_unless($row, 404);
        $data = $this->validated($request);
        abort_unless($data['material_id'] === $row->material_id, 422);
        $this->assertPeriodAvailable($row->material_id, $data['effective_from'], $data['effective_until'] ?? null, $id);
        DB::transaction(function () use ($request, $data, $id, $row) {
            DB::table('material_prices')->where('id', $id)->update([
                'price' => $data['price'], 'effective_from' => $data['effective_from'],
                'effective_until' => $data['effective_until'] ?? null, 'updated_at' => now(),
            ]);
            $this->snapshot($request, $id, $data, 'updated');
            $this->syncCurrentPrice($row->material_id);
        });
        return response()->json(['message' => 'Harga bahan dan snapshot berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = DB::table('material_prices')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->first();
        abort_unless($row, 404);
        DB::transaction(function () use ($request, $row) {
            $this->snapshot($request, $row->id, (array) $row, 'deleted');
            SoftDeleteAudit::record($request, 'material_prices', $row);
            DB::table('material_prices')->where('id', $row->id)->update(['deleted_at' => now(), 'updated_at' => now()]);
            $this->syncCurrentPrice($row->material_id);
        });
        return response()->json(['message' => 'Harga bahan berhasil dihapus.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'material_id' => ['required', Rule::exists('materials', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')],
            'price' => ['required', 'numeric', 'min:0'],
            'effective_from' => ['required', 'date'],
            'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
        ]);
    }

    private function assertPeriodAvailable(string $materialId, string $from, ?string $until, ?string $ignore = null): void
    {
        $query = DB::table('material_prices')->where('material_id', $materialId)->whereNull('deleted_at');
        if ($ignore) $query->where('id', '!=', $ignore);
        $overlap = $query->whereDate('effective_from', '<=', $until ?: '9999-12-31')
            ->where(fn ($q) => $q->whereNull('effective_until')->orWhereDate('effective_until', '>=', $from))->exists();
        if ($overlap) throw ValidationException::withMessages(['effective_from' => 'Periode harga bahan bertabrakan dengan periode yang sudah ada.']);
    }

    private function snapshot(Request $request, string $priceId, array $data, string $action): void
    {
        DB::table('material_price_snapshots')->insert([
            'id' => (string) Str::uuid(), 'company_id' => $request->user()->company_id,
            'material_id' => $data['material_id'], 'material_price_id' => $priceId, 'action' => $action,
            'price' => $data['price'], 'effective_from' => $data['effective_from'],
            'effective_until' => $data['effective_until'] ?? null, 'created_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function syncCurrentPrice(string $materialId): void
    {
        $price = DB::table('material_prices')->where('material_id', $materialId)->whereNull('deleted_at')
            ->whereDate('effective_from', '<=', today())
            ->where(fn ($q) => $q->whereNull('effective_until')->orWhereDate('effective_until', '>=', today()))
            ->orderByDesc('effective_from')->value('price');
        DB::table('materials')->where('id', $materialId)->update(['average_cost' => $price ?? 0, 'updated_at' => now()]);
    }
}
