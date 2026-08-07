<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use App\Support\SoftDeleteAudit;

class RecipeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $recipes = DB::table('recipes as r')
            ->join('products as p', 'p.id', '=', 'r.product_id')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'r.variant_id')
            ->join('units as u', 'u.id', '=', 'r.yield_unit_id')
            ->leftJoin('outlets as o', 'o.id', '=', 'p.outlet_id')
            ->whereNull('r.deleted_at')
            ->where('p.company_id', $request->user()->company_id)
            ->orderBy('p.name')
            ->select(['r.*', 'p.name as product_name', 'p.sku', 'p.outlet_id',
                'p.selling_price', 'u.code as yield_unit', 'pv.name as variant_name',
                'pv.sku as variant_sku', 'pv.selling_price as variant_selling_price'])
            ->selectRaw("COALESCE(o.name, 'Semua Store') as outlet_name")
            ->get();

        $items = DB::table('recipe_items as ri')
            ->join('materials as m', 'm.id', '=', 'ri.material_id')
            ->join('units as u', 'u.id', '=', 'ri.unit_id')
            ->whereIn('ri.recipe_id', $recipes->pluck('id'))
            ->orderBy('m.name')
            ->get(['ri.*', 'm.name as material_name', 'm.sku as material_sku',
                'm.average_cost as unit_cost', 'u.code as unit_code'])
            ->groupBy('recipe_id');

        return response()->json($recipes->map(fn ($recipe) => [
            ...((array) $recipe),
            'items' => $items->get($recipe->id, collect())->values(),
            'hpp' => $items->get($recipe->id, collect())->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_cost)
                / (float) $recipe->yield_quantity,
            'selling_price' => (float) ($recipe->variant_selling_price ?? 0),
        ]));
    }

    public function options(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        return response()->json([
            'products' => DB::table('products')
                ->join('product_variants as pv', 'pv.product_id', '=', 'products.id')
                ->where('products.company_id', $companyId)->whereNull('products.deleted_at')
                ->where('products.product_type', 'menu')->where('products.is_active', true)->where('pv.is_active', true)
                ->orderBy('products.name')->orderByRaw("CASE pv.name WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 ELSE 4 END")
                ->select(['products.id', 'products.sku', 'products.name', 'products.base_unit_id', 'products.selling_price',
                    'products.average_cost', 'pv.id as variant_id', 'pv.name as variant_name', 'pv.sku as variant_sku', 'pv.price_delta'])
                ->selectRaw('EXISTS (SELECT 1 FROM recipes WHERE recipes.product_id = products.id AND recipes.variant_id = pv.id AND recipes.deleted_at IS NULL) as has_recipe')
                ->get(),
            'materials' => DB::table('materials')->where('company_id', $companyId)->whereNull('deleted_at')
                ->where('is_active', true)
                ->whereExists(function ($query) {
                    $query->selectRaw('1')->from('material_prices as mp')
                        ->whereColumn('mp.material_id', 'materials.id')
                        ->whereNull('mp.deleted_at')
                        ->whereDate('mp.effective_from', '<=', today())
                        ->where(function ($period) {
                            $period->whereNull('mp.effective_until')
                                ->orWhereDate('mp.effective_until', '>=', today());
                        });
                })
                ->orderBy('name')
                ->get(['id', 'sku', 'name', 'base_unit_id', 'average_cost']),
            'units' => DB::table('units')->orderBy('name')->get(['id', 'code', 'name']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, $request->user()->company_id);
        $id = (string) Str::uuid();

        DB::transaction(function () use ($id, $data) {
            DB::table('recipes')->insert([
                'id' => $id,
                'product_id' => $data['product_id'],
                'variant_id' => $data['variant_id'],
                'yield_quantity' => $data['yield_quantity'],
                'yield_unit_id' => $data['yield_unit_id'],
                'version' => 1,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->insertItems($id, $data['items']);
        });

        return response()->json(['message' => 'Resep berhasil dibuat.', 'id' => $id], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless(DB::table('recipes as r')->join('products as p', 'p.id', '=', 'r.product_id')
            ->where('r.id', $id)->whereNull('r.deleted_at')->where('p.company_id', $request->user()->company_id)->exists(), 404);
        $data = $this->validated($request, $request->user()->company_id, $id);

        DB::transaction(function () use ($id, $data) {
            DB::table('recipes')->where('id', $id)->update([
                'product_id' => $data['product_id'],
                'variant_id' => $data['variant_id'],
                'yield_quantity' => $data['yield_quantity'],
                'yield_unit_id' => $data['yield_unit_id'],
                'updated_at' => now(),
            ]);
            DB::table('recipe_items')->where('recipe_id', $id)->delete();
            $this->insertItems($id, $data['items']);
        });

        return response()->json(['message' => 'Resep berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $query = DB::table('recipes as r')->join('products as p', 'p.id', '=', 'r.product_id')
            ->where('r.id', $id)->whereNull('r.deleted_at')->where('p.company_id', $request->user()->company_id);
        abort_unless($query->exists(), 404);
        $row = DB::table('recipes')->where('id', $id)->first();
        DB::transaction(function () use ($request, $id, $row) {
            SoftDeleteAudit::record($request, 'recipes', $row);
            DB::table('recipes')->where('id', $id)->update(['deleted_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['message' => 'Resep berhasil dihapus.']);
    }

    private function validated(Request $request, string $companyId, ?string $id = null): array
    {
        $data = $request->validate([
            'product_id' => ['required', Rule::exists('products', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'variant_id' => ['required', 'exists:product_variants,id'],
            'yield_quantity' => ['required', 'numeric', 'gt:0'],
            'yield_unit_id' => ['required', 'exists:units,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.material_id' => [
                'required',
                'distinct',
                Rule::exists('materials', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
                Rule::exists('material_prices', 'material_id')
                    ->whereNull('deleted_at')
                    ->where(function ($query) {
                        $query->whereDate('effective_from', '<=', today())
                            ->where(function ($period) {
                                $period->whereNull('effective_until')
                                    ->orWhereDate('effective_until', '>=', today());
                            });
                    }),
            ],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'exists:units,id'],
        ], [
            'items.*.material_id.exists' => 'Bahan tidak tersedia atau belum memiliki harga aktif. Tetapkan Harga Bahan terlebih dahulu.',
        ]);

        abort_unless(DB::table('product_variants')->where('id', $data['variant_id'])
            ->where('product_id', $data['product_id'])->exists(), 422, 'Ukuran tidak sesuai dengan produk yang dipilih.');
        $duplicate = DB::table('recipes')->where('product_id', $data['product_id'])
            ->where('variant_id', $data['variant_id'])->whereNull('deleted_at')
            ->when($id, fn ($query) => $query->where('id', '!=', $id))->exists();
        abort_if($duplicate, 422, 'Resep untuk produk dan ukuran ini sudah tersedia.');

        return $data;
    }

    private function insertItems(string $recipeId, array $items): void
    {
        foreach ($items as $item) {
            DB::table('recipe_items')->insert([
                'id' => (string) Str::uuid(),
                'recipe_id' => $recipeId,
                'ingredient_product_id' => null,
                'material_id' => $item['material_id'],
                'unit_id' => $item['unit_id'],
                'quantity' => $item['quantity'],
                'waste_percentage' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function outletId(Request $request): string
    {
        $id = $request->input('outlet_id', $request->user()->outlet_id);
        abort_unless($id, 422, 'Pilih store terlebih dahulu.');
        abort_unless(DB::table('outlets')->where('id', $id)
            ->where('company_id', $request->user()->company_id)->exists(), 403);
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
