<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PromotionController extends Controller
{
    public function promotions(Request $request): JsonResponse
    {
        return response()->json(DB::table('promotions')->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->orderByDesc('effective_from')->get());
    }

    public function storePromotion(Request $request): JsonResponse
    {
        $data = $this->promotionData($request);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($request, $data, $id) {
            DB::table('companies')->where('id', $request->user()->company_id)->lockForUpdate()->first();
            $number = DB::table('promotions')->where('company_id', $request->user()->company_id)->count() + 1;
            DB::table('promotions')->insert([...$data, 'id' => $id, 'company_id' => $request->user()->company_id,
                'code' => 'PRM-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT), 'created_at' => now(), 'updated_at' => now()]);
        });
        return response()->json(['message' => 'Master promo berhasil dibuat.', 'id' => $id], 201);
    }

    public function updatePromotion(Request $request, string $id): JsonResponse
    {
        $data = $this->promotionData($request);
        $updated = DB::table('promotions')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->update([...$data, 'updated_at' => now()]);
        abort_unless($updated, 404);
        $this->recalculatePromotion($id);
        return response()->json(['message' => 'Master promo berhasil diperbarui.']);
    }

    public function deletePromotion(Request $request, string $id): JsonResponse
    {
        abort_if(DB::table('product_promotions')->where('promotion_id', $id)->whereNull('deleted_at')->exists(), 422, 'Promo sudah dipakai produk dan tidak dapat dihapus.');
        DB::table('promotions')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Promo berhasil dihapus.']);
    }

    public function options(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        return response()->json([
            'products' => DB::table('products')->where('company_id', $companyId)->whereNull('deleted_at')->where('is_active', true)
                ->orderBy('name')->get(['id', 'sku', 'name', 'selling_price']),
            'bundles' => DB::table('product_bundles')->where('company_id', $companyId)->whereNull('deleted_at')->where('is_active', true)
                ->whereDate('effective_from', '<=', today())
                ->where(fn ($query) => $query->whereNull('effective_until')->orWhereDate('effective_until', '>=', today()))
                ->orderBy('name')->get(['id', 'sku', 'name', 'selling_price']),
            'promotions' => DB::table('promotions')->where('company_id', $companyId)->whereNull('deleted_at')->where('is_active', true)
                ->whereDate('effective_from', '<=', today())
                ->whereDate('effective_until', '>=', today())
                ->orderByDesc('effective_from')->get(),
        ]);
    }

    public function productPromotions(Request $request): JsonResponse
    {
        return response()->json(DB::table('product_promotions as pp')->leftJoin('products as p', 'p.id', '=', 'pp.product_id')
            ->leftJoin('product_bundles as pb', 'pb.id', '=', 'pp.product_bundle_id')
            ->join('promotions as pr', 'pr.id', '=', 'pp.promotion_id')->where('pp.company_id', $request->user()->company_id)
            ->whereNull('pp.deleted_at')->select('pp.*', DB::raw('COALESCE(p.sku, pb.sku) as sku'), DB::raw('COALESCE(p.name, pb.name) as product_name'),
                DB::raw("CASE WHEN pp.product_bundle_id IS NULL THEN 'product' ELSE 'bundle' END as target_type"), 'pr.code as promotion_code',
                'pr.name as promotion_name', 'pr.discount_type', 'pr.discount_value', 'pr.effective_from', 'pr.effective_until')
            ->orderByDesc('pr.effective_from')->get());
    }

    public function storeProductPromotion(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'target_type' => ['required', Rule::in(['product', 'bundle'])],
            'target_id' => ['required', 'uuid'],
            'promotion_id' => ['required', Rule::exists('promotions', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
        ]);
        $target = $this->promotionTarget($companyId, $data['target_type'], $data['target_id']);
        $promo = DB::table('promotions')->where('id', $data['promotion_id'])->first();
        if (! $promo->is_active || $promo->effective_from > today()->toDateString() || $promo->effective_until < today()->toDateString()) {
            throw ValidationException::withMessages(['promotion_id' => 'Promo tidak aktif atau berada di luar periode berlaku.']);
        }
        $targetColumn = $data['target_type'] === 'bundle' ? 'product_bundle_id' : 'product_id';
        $existing = DB::table('product_promotions')->where($targetColumn, $target->id)
            ->where('promotion_id', $promo->id)->first();
        if ($existing && $existing->deleted_at === null) {
            throw ValidationException::withMessages(['promotion_id' => 'Produk sudah terdaftar pada promo yang sama. Pilih promo lain.']);
        }
        $values = ['company_id' => $companyId, 'product_id' => $data['target_type'] === 'product' ? $target->id : null,
            'product_bundle_id' => $data['target_type'] === 'bundle' ? $target->id : null, 'promotion_id' => $promo->id,
            'original_price' => $target->selling_price, 'promo_price' => $this->promoPrice((float) $target->selling_price, $promo),
            'deleted_at' => null, 'updated_at' => now()];
        if ($existing) {
            DB::table('product_promotions')->where('id', $existing->id)->update($values);
        } else {
            DB::table('product_promotions')->insert([...$values, 'id' => (string) Str::uuid(), 'created_at' => now()]);
        }
        return response()->json(['message' => 'Produk promo berhasil dibuat.'], 201);
    }

    public function deleteProductPromotion(Request $request, string $id): JsonResponse
    {
        DB::table('product_promotions')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Produk promo berhasil dihapus.']);
    }

    public function updateProductPromotion(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $current = DB::table('product_promotions')->where('id', $id)->where('company_id', $companyId)
            ->whereNull('deleted_at')->first();
        abort_unless($current, 404);
        $data = $request->validate([
            'target_type' => ['required', Rule::in(['product', 'bundle'])],
            'target_id' => ['required', 'uuid'],
            'promotion_id' => ['required', Rule::exists('promotions', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
        ]);
        $target = $this->promotionTarget($companyId, $data['target_type'], $data['target_id']);
        $promo = DB::table('promotions')->where('id', $data['promotion_id'])->first();
        if (! $promo->is_active || $promo->effective_from > today()->toDateString() || $promo->effective_until < today()->toDateString()) {
            throw ValidationException::withMessages(['promotion_id' => 'Promo tidak aktif atau berada di luar periode berlaku.']);
        }
        $targetColumn = $data['target_type'] === 'bundle' ? 'product_bundle_id' : 'product_id';
        $duplicate = DB::table('product_promotions')->where($targetColumn, $target->id)
            ->where('promotion_id', $promo->id)->where('id', '!=', $id)->whereNull('deleted_at')->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['promotion_id' => 'Produk sudah terdaftar pada promo yang sama. Pilih promo lain.']);
        }
        DB::table('product_promotions')->where('id', $id)->update([
            'product_id' => $data['target_type'] === 'product' ? $target->id : null,
            'product_bundle_id' => $data['target_type'] === 'bundle' ? $target->id : null,
            'promotion_id' => $promo->id, 'original_price' => $target->selling_price,
            'promo_price' => $this->promoPrice((float) $target->selling_price, $promo),
            'updated_at' => now(),
        ]);
        return response()->json(['message' => 'Produk promo berhasil diperbarui.']);
    }

    public function bundles(Request $request): JsonResponse
    {
        $rows = DB::table('product_bundles')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')
            ->orderByDesc('effective_from')->get();
        $items = DB::table('product_bundle_items as bi')->join('products as p', 'p.id', '=', 'bi.product_id')
            ->whereIn('bi.product_bundle_id', $rows->pluck('id'))->get(['bi.*', 'p.sku', 'p.name as product_name'])->groupBy('product_bundle_id');
        return response()->json($rows->map(fn ($row) => [...((array) $row), 'items' => $items->get($row->id, collect())->values()]));
    }

    public function storeBundle(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:180'], 'selling_price' => ['required', 'numeric', 'gt:0'],
            'effective_from' => ['required', 'date'], 'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'items' => ['required', 'array', 'min:2'], 'items.*.product_id' => ['required', 'distinct', Rule::exists('products', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0']]);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($data, $companyId, $id) {
            DB::table('companies')->where('id', $companyId)->lockForUpdate()->first();
            $number = DB::table('product_bundles')->where('company_id', $companyId)->count() + 1;
            DB::table('product_bundles')->insert(['id' => $id, 'company_id' => $companyId, 'sku' => 'BND-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'name' => $data['name'], 'selling_price' => $data['selling_price'], 'effective_from' => $data['effective_from'], 'effective_until' => $data['effective_until'],
                'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
            foreach ($data['items'] as $item) {
                $price = DB::table('products')->where('id', $item['product_id'])->value('selling_price');
                DB::table('product_bundle_items')->insert(['product_bundle_id' => $id, 'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'], 'unit_price_snapshot' => $price, 'created_at' => now(), 'updated_at' => now()]);
            }
        });
        return response()->json(['message' => 'Produk bundling berhasil dibuat.', 'id' => $id], 201);
    }

    public function updateBundle(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $bundle = DB::table('product_bundles')->where('id', $id)->where('company_id', $companyId)
            ->whereNull('deleted_at')->first();
        abort_unless($bundle, 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'selling_price' => ['required', 'numeric', 'gt:0'],
            'effective_from' => ['required', 'date'],
            'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'items' => ['required', 'array', 'min:2'],
            'items.*.product_id' => ['required', 'distinct', Rule::exists('products', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        DB::transaction(function () use ($data, $id) {
            DB::table('product_bundles')->where('id', $id)->update([
                'name' => $data['name'],
                'selling_price' => $data['selling_price'],
                'effective_from' => $data['effective_from'],
                'effective_until' => $data['effective_until'],
                'updated_at' => now(),
            ]);
            DB::table('product_bundle_items')->where('product_bundle_id', $id)->delete();
            foreach ($data['items'] as $item) {
                $price = DB::table('products')->where('id', $item['product_id'])->value('selling_price');
                DB::table('product_bundle_items')->insert([
                    'product_bundle_id' => $id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price_snapshot' => $price,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json(['message' => 'Produk bundling berhasil diperbarui.']);
    }

    public function deleteBundle(Request $request, string $id): JsonResponse
    {
        DB::table('product_bundles')->where('id', $id)->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Bundling berhasil dihapus.']);
    }

    private function promotionData(Request $request): array
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:150'], 'discount_type' => ['required', Rule::in(['percentage', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'gt:0'], 'effective_from' => ['required', 'date'],
            'effective_until' => ['required', 'date', 'after_or_equal:effective_from'], 'is_active' => ['required', 'boolean']]);
        if ($data['discount_type'] === 'percentage' && (float) $data['discount_value'] > 100) throw ValidationException::withMessages(['discount_value' => 'Diskon persen maksimal 100%.']);
        return $data;
    }

    private function promotionTarget(string $companyId, string $type, string $id): object
    {
        $table = $type === 'bundle' ? 'product_bundles' : 'products';
        $target = DB::table($table)->where('id', $id)->where('company_id', $companyId)->whereNull('deleted_at')->first();
        if (! $target) {
            throw ValidationException::withMessages(['target_id' => 'Produk atau bundling tidak ditemukan.']);
        }
        return $target;
    }

    private function promoPrice(float $price, object $promo): float
    {
        return max(0, $promo->discount_type === 'percentage' ? $price * (1 - ((float) $promo->discount_value / 100)) : $price - (float) $promo->discount_value);
    }

    private function recalculatePromotion(string $promotionId): void
    {
        $promo = DB::table('promotions')->where('id', $promotionId)->first();
        foreach (DB::table('product_promotions')->where('promotion_id', $promotionId)->whereNull('deleted_at')->get() as $row)
            DB::table('product_promotions')->where('id', $row->id)->update(['promo_price' => $this->promoPrice((float) $row->original_price, $promo), 'updated_at' => now()]);
    }
}
