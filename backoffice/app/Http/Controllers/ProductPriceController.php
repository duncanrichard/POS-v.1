<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Support\SoftDeleteAudit;

class ProductPriceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        DB::table('product_price_snapshots')->where('company_id', $request->user()->company_id)
            ->whereNull('deleted_at')->whereNotNull('variant_id')->distinct()->pluck('variant_id')
            ->each(fn ($variantId) => $this->syncCurrentVariantPrice($variantId));

        return response()->json(DB::table('product_price_snapshots as ps')
            ->join('products as p', 'p.id', '=', 'ps.product_id')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'ps.variant_id')
            ->where('ps.company_id', $request->user()->company_id)
            ->whereNull('ps.deleted_at')
            ->orderBy('p.name')->orderByDesc('ps.effective_from')
            ->select('ps.*', 'p.sku', 'p.name as product_name', 'pv.name as variant_name', 'pv.sku as variant_sku')
            ->selectRaw("CASE WHEN ps.effective_from > CURRENT_DATE THEN 'soon' WHEN ps.effective_until IS NOT NULL AND ps.effective_until < CURRENT_DATE THEN 'expired' ELSE 'active' END as price_status")
            ->get());
    }

    public function options(Request $request): JsonResponse
    {
        $recipes = DB::table('recipes as r')
            ->join('products as p', 'p.id', '=', 'r.product_id')
            ->join('product_variants as pv', 'pv.id', '=', 'r.variant_id')
            ->where('p.company_id', $request->user()->company_id)
            ->whereNull('r.deleted_at')->whereNull('p.deleted_at')
            ->orderBy('p.name')
            ->get(['r.id as recipe_id', 'r.yield_quantity', 'r.variant_id', 'p.id as product_id', 'p.sku',
                'p.name', 'pv.name as variant_name', 'pv.sku as variant_sku', 'pv.selling_price as current_selling_price']);
        $items = DB::table('recipe_items as ri')
            ->join('materials as m', 'm.id', '=', 'ri.material_id')
            ->join('units as u', 'u.id', '=', 'ri.unit_id')
            ->whereIn('ri.recipe_id', $recipes->pluck('recipe_id'))
            ->get(['ri.recipe_id', 'm.id as material_id', 'm.sku', 'm.name', 'm.average_cost as unit_cost',
                'ri.quantity', 'u.code as unit_code'])->groupBy('recipe_id');
        $periods = DB::table('product_price_snapshots')->whereNull('deleted_at')->whereIn('product_id', $recipes->pluck('product_id'))
            ->get(['product_id', 'effective_from', 'effective_until'])->groupBy('product_id');

        return response()->json($recipes->map(function ($recipe) use ($items, $periods) {
            $productPeriods = $periods->get($recipe->product_id, collect());
            $locked = $productPeriods->contains(fn ($period) => $period->effective_until === null);
            $lastUntil = $productPeriods->whereNotNull('effective_until')->max('effective_until');
            return [
                ...((array) $recipe),
                'items' => $items->get($recipe->recipe_id, collect())->values(),
                'price_locked' => $locked,
                'next_start_date' => $lastUntil ? \Carbon\Carbon::parse($lastUntil)->addDay()->toDateString() : null,
            ];
        }));
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->has('prices')) {
            return $this->storeBatch($request);
        }
        $data = $request->validate([
            'recipe_id' => ['required', 'exists:recipes,id'],
            'hpp' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'effective_from' => ['required', 'date'],
            'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
        ]);
        $recipe = DB::table('recipes as r')->join('products as p', 'p.id', '=', 'r.product_id')
            ->where('r.id', $data['recipe_id'])->where('p.company_id', $request->user()->company_id)
            ->whereNull('r.deleted_at')->whereNull('p.deleted_at')
            ->first(['r.id', 'r.product_id', 'r.variant_id', 'r.yield_quantity']);
        abort_unless($recipe, 404);
        $items = DB::table('recipe_items as ri')->join('materials as m', 'm.id', '=', 'ri.material_id')
            ->join('units as u', 'u.id', '=', 'ri.unit_id')->where('ri.recipe_id', $recipe->id)
            ->get(['m.id as material_id', 'm.sku', 'm.name', 'm.average_cost as unit_cost', 'ri.quantity', 'u.code as unit_code']);
        $ingredientCost = $items->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_cost)
            / (float) $recipe->yield_quantity;
        if ((float) $data['hpp'] < $ingredientCost) {
            throw ValidationException::withMessages(['hpp' => 'HPP tidak boleh kurang dari total ingredient Rp '.number_format($ingredientCost, 2, ',', '.')]);
        }
        if ((float) $data['selling_price'] < (float) $data['hpp']) {
            throw ValidationException::withMessages(['selling_price' => 'Harga jual tidak boleh kurang dari HPP.']);
        }

        $periods = DB::table('product_price_snapshots')->whereNull('deleted_at')->where('variant_id', $recipe->variant_id);
        if ((clone $periods)->whereNull('effective_until')->exists()) {
            throw ValidationException::withMessages([
                'effective_from' => 'Produk ini memiliki harga tanpa tanggal akhir. Tutup periode harga tersebut terlebih dahulu sebelum membuat harga baru.',
            ]);
        }
        $overlap = (clone $periods)
            ->where(function ($query) use ($data) {
                if (!empty($data['effective_until'])) {
                    $query->whereDate('effective_from', '<=', $data['effective_until']);
                }
            })
            ->where(function ($query) use ($data) {
                $query->whereNull('effective_until')->orWhereDate('effective_until', '>=', $data['effective_from']);
            })->exists();
        if ($overlap) {
            $lastUntil = (clone $periods)->max('effective_until');
            $nextDate = $lastUntil ? \Carbon\Carbon::parse($lastUntil)->addDay()->format('d/m/Y') : null;
            throw ValidationException::withMessages([
                'effective_from' => 'Periode harga bertumpuk dengan data sebelumnya.'.($nextDate ? ' Tanggal mulai berikutnya paling cepat '.$nextDate.'.' : ''),
            ]);
        }

        $id = (string) Str::uuid();
        DB::transaction(function () use ($id, $request, $data, $recipe, $items, $ingredientCost) {
            DB::table('product_price_snapshots')->insert([
                'id' => $id, 'company_id' => $request->user()->company_id,
                'product_id' => $recipe->product_id, 'variant_id' => $recipe->variant_id, 'recipe_id' => $recipe->id,
                'ingredient_cost' => $ingredientCost, 'hpp' => $data['hpp'],
                'selling_price' => $data['selling_price'], 'effective_from' => $data['effective_from'],
                'effective_until' => $data['effective_until'] ?? null,
                'ingredient_snapshot' => json_encode($items), 'created_by' => $request->user()->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->syncCurrentVariantPrice($recipe->variant_id);
        });
        return response()->json(['message' => 'Harga terbaru dan snapshot berhasil disimpan.', 'id' => $id], 201);
    }

    private function storeBatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'effective_from' => ['required', 'date'],
            'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'prices' => ['required', 'array', 'min:1'],
            'prices.*.recipe_id' => ['required', 'distinct', 'exists:recipes,id'],
            'prices.*.hpp' => ['required', 'numeric', 'min:0'],
            'prices.*.selling_price' => ['required', 'numeric', 'min:0'],
        ]);
        $product = DB::table('products')->where('id', $data['product_id'])
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($product, 404);

        $recipes = DB::table('recipes')->whereIn('id', collect($data['prices'])->pluck('recipe_id'))
            ->where('product_id', $product->id)->whereNull('deleted_at')->get()->keyBy('id');
        abort_unless($recipes->count() === count($data['prices']), 422, 'Semua harga harus berasal dari resep produk yang sama.');

        $periods = DB::table('product_price_snapshots')->where('product_id', $product->id)->whereNull('deleted_at');
        abort_if((clone $periods)->whereNull('effective_until')->exists(), 422, 'Produk masih memiliki periode harga tanpa tanggal akhir. Tutup periode tersebut terlebih dahulu.');
        $lastUntil = (clone $periods)->max('effective_until');
        if ($lastUntil) {
            $expected = \Carbon\Carbon::parse($lastUntil)->addDay()->toDateString();
            if ($data['effective_from'] !== $expected) {
                throw ValidationException::withMessages(['effective_from' => 'Tanggal mulai periode baru harus '.$expected.', satu hari setelah periode sebelumnya berakhir.']);
            }
        }

        $batchId = (string) Str::uuid();
        DB::transaction(function () use ($data, $request, $recipes, $batchId) {
            foreach ($data['prices'] as $entry) {
                $recipe = $recipes->get($entry['recipe_id']);
                $items = DB::table('recipe_items as ri')->join('materials as m', 'm.id', '=', 'ri.material_id')
                    ->join('units as u', 'u.id', '=', 'ri.unit_id')->where('ri.recipe_id', $recipe->id)
                    ->get(['m.id as material_id', 'm.sku', 'm.name', 'm.average_cost as unit_cost', 'ri.quantity', 'u.code as unit_code']);
                $cost = $items->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_cost) / (float) $recipe->yield_quantity;
                if ((float) $entry['hpp'] < $cost || (float) $entry['selling_price'] < (float) $entry['hpp']) {
                    throw ValidationException::withMessages(['prices' => 'HPP dan harga jual setiap ukuran harus sesuai biaya resep.']);
                }
                DB::table('product_price_snapshots')->insert([
                    'id' => (string) Str::uuid(), 'price_batch_id' => $batchId,
                    'company_id' => $request->user()->company_id, 'product_id' => $recipe->product_id,
                    'variant_id' => $recipe->variant_id, 'recipe_id' => $recipe->id,
                    'ingredient_cost' => $cost, 'hpp' => $entry['hpp'], 'selling_price' => $entry['selling_price'],
                    'effective_from' => $data['effective_from'], 'effective_until' => $data['effective_until'] ?: null,
                    'ingredient_snapshot' => json_encode($items), 'created_by' => $request->user()->id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->syncCurrentVariantPrice($recipe->variant_id);
            }
        });
        return response()->json(['message' => 'Jadwal harga semua ukuran berhasil disimpan.', 'batch_id' => $batchId], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $old = DB::table('product_price_snapshots')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($old, 404);
        DB::transaction(function () use ($request, $old) {
            SoftDeleteAudit::record($request, 'product_price_snapshots', $old, 'Digantikan oleh versi harga baru');
            DB::table('product_price_snapshots')->where('id', $old->id)
                ->update(['deleted_at' => now(), 'updated_at' => now()]);
        });
        try {
            return $this->store($request);
        } catch (\Throwable $exception) {
            DB::table('product_price_snapshots')->where('id', $old->id)->update(['deleted_at' => null, 'updated_at' => now()]);
            DB::table('soft_delete_records')->where('source_table', 'product_price_snapshots')
                ->where('source_id', $old->id)->where('reason', 'Digantikan oleh versi harga baru')->delete();
            throw $exception;
        }
    }

    public function closePeriod(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['effective_until' => ['required', 'date']]);
        $row = DB::table('product_price_snapshots')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($row, 404);
        abort_if($data['effective_until'] < $row->effective_from, 422, 'Tanggal akhir tidak boleh sebelum tanggal mulai.');
        $query = DB::table('product_price_snapshots')->whereNull('deleted_at');
        $row->price_batch_id ? $query->where('price_batch_id', $row->price_batch_id) : $query->where('id', $row->id);
        $query->update(['effective_until' => $data['effective_until'], 'updated_at' => now()]);

        return response()->json(['message' => 'Periode harga ditutup. Jadwal berikutnya dapat dibuat mulai hari selanjutnya.']);
    }

    public function updateBatchPrices(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'prices' => ['required', 'array', 'min:1'],
            'prices.*.id' => ['required', 'distinct', 'uuid'],
            'prices.*.selling_price' => ['required', 'numeric', 'min:0'],
        ]);
        $period = DB::table('product_price_snapshots')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($period, 404);

        $periodRows = DB::table('product_price_snapshots')->whereNull('deleted_at')
            ->where('company_id', $request->user()->company_id);
        $period->price_batch_id
            ? $periodRows->where('price_batch_id', $period->price_batch_id)
            : $periodRows->where('product_id', $period->product_id)
                ->where('effective_from', $period->effective_from)
                ->where('effective_until', $period->effective_until);
        $rows = $periodRows->get()->keyBy('id');
        abort_unless($rows->count() === count($data['prices']), 422, 'Semua ukuran pada periode harus dikirim saat mengubah harga.');

        DB::transaction(function () use ($data, $rows) {
            foreach ($data['prices'] as $entry) {
                $row = $rows->get($entry['id']);
                abort_unless($row, 422, 'Ukuran harga tidak sesuai dengan periode.');
                if ((float) $entry['selling_price'] < (float) $row->hpp) {
                    throw ValidationException::withMessages([
                        'prices' => 'Harga jual ukuran tidak boleh kurang dari HPP.',
                    ]);
                }
                DB::table('product_price_snapshots')->where('id', $row->id)->update([
                    'selling_price' => $entry['selling_price'],
                    'updated_at' => now(),
                ]);
                $this->syncCurrentVariantPrice($row->variant_id);
            }
        });

        return response()->json(['message' => 'Harga seluruh ukuran pada periode berhasil diperbarui.']);
    }

    public function addSizes(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'prices' => ['required', 'array', 'min:1'],
            'prices.*.recipe_id' => ['required', 'distinct', 'exists:recipes,id'],
            'prices.*.hpp' => ['required', 'numeric', 'min:0'],
            'prices.*.selling_price' => ['required', 'numeric', 'min:0'],
        ]);
        $period = DB::table('product_price_snapshots')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($period, 404);
        $recipes = DB::table('recipes')->whereIn('id', collect($data['prices'])->pluck('recipe_id'))
            ->where('product_id', $period->product_id)->whereNull('deleted_at')->get()->keyBy('id');
        abort_unless($recipes->count() === count($data['prices']), 422, 'Ukuran tidak sesuai dengan produk pada periode ini.');
        $periodQuery = DB::table('product_price_snapshots')->whereNull('deleted_at');
        $period->price_batch_id ? $periodQuery->where('price_batch_id', $period->price_batch_id) : $periodQuery->where('product_id', $period->product_id)->where('effective_from', $period->effective_from)->where('effective_until', $period->effective_until);
        $existingVariants = $periodQuery->pluck('variant_id');

        DB::transaction(function () use ($data, $request, $recipes, $period, $existingVariants) {
            foreach ($data['prices'] as $entry) {
                $recipe = $recipes->get($entry['recipe_id']);
                abort_if($existingVariants->contains($recipe->variant_id), 422, 'Ukuran tersebut sudah memiliki harga pada periode ini.');
                $items = DB::table('recipe_items as ri')->join('materials as m', 'm.id', '=', 'ri.material_id')
                    ->join('units as u', 'u.id', '=', 'ri.unit_id')->where('ri.recipe_id', $recipe->id)
                    ->get(['m.id as material_id', 'm.sku', 'm.name', 'm.average_cost as unit_cost', 'ri.quantity', 'u.code as unit_code']);
                $cost = $items->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_cost) / (float) $recipe->yield_quantity;
                abort_if((float) $entry['hpp'] < $cost || (float) $entry['selling_price'] < (float) $entry['hpp'], 422, 'Harga ukuran tidak sesuai dengan HPP resep.');
                DB::table('product_price_snapshots')->insert([
                    'id' => (string) Str::uuid(), 'price_batch_id' => $period->price_batch_id,
                    'company_id' => $request->user()->company_id, 'product_id' => $period->product_id,
                    'variant_id' => $recipe->variant_id, 'recipe_id' => $recipe->id,
                    'ingredient_cost' => $cost, 'hpp' => $entry['hpp'], 'selling_price' => $entry['selling_price'],
                    'effective_from' => $period->effective_from, 'effective_until' => $period->effective_until,
                    'ingredient_snapshot' => json_encode($items), 'created_by' => $request->user()->id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->syncCurrentVariantPrice($recipe->variant_id);
            }
        });
        return response()->json(['message' => 'Ukuran berhasil ditambahkan ke periode harga yang sama.'], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = DB::table('product_price_snapshots')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->first();
        abort_unless($row, 404);
        $batchRows = $row->price_batch_id
            ? DB::table('product_price_snapshots')->where('price_batch_id', $row->price_batch_id)->whereNull('deleted_at')->get()
            : collect([$row]);
        DB::transaction(function () use ($request, $batchRows) {
            foreach ($batchRows as $batchRow) {
                SoftDeleteAudit::record($request, 'product_price_snapshots', $batchRow);
                DB::table('product_price_snapshots')->where('id', $batchRow->id)
                    ->update(['deleted_at' => now(), 'updated_at' => now()]);
                if ($batchRow->variant_id) $this->syncCurrentVariantPrice($batchRow->variant_id);
            }
        });
        return response()->json(['message' => 'Satu periode harga produk berhasil dihapus.']);
    }

    private function syncCurrentVariantPrice(string $variantId): void
    {
        $price = DB::table('product_price_snapshots')->where('variant_id', $variantId)
            ->whereNull('deleted_at')->whereDate('effective_from', '<=', today())
            ->where(fn ($query) => $query->whereNull('effective_until')->orWhereDate('effective_until', '>=', today()))
            ->orderByDesc('effective_from')->first();
        DB::table('product_variants')->where('id', $variantId)->update([
            'selling_price' => $price?->selling_price ?? 0,
            'updated_at' => now(),
        ]);
    }
}
