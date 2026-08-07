<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PosCatalogController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'outlet' => ['required', 'string', 'max:50'],
        ]);
        abort_unless($request->user() && $request->user()->outlet_id, 401);

        $outletQuery = DB::table('outlets as o')
            ->join('companies as c', 'c.id', '=', 'o.company_id')
            ->where('o.status', 'active')
            ->where('c.is_active', true)
            ->whereNull('o.deleted_at');

        if (Str::isUuid($data['outlet'])) {
            $outletQuery->where('o.id', $data['outlet']);
        } else {
            $outletQuery->where('o.code', $data['outlet']);
        }

        $outlet = $outletQuery->first(['o.id', 'o.code', 'o.name', 'o.company_id']);

        abort_unless($outlet, 404, 'Store tidak ditemukan atau sedang tidak aktif.');
        abort_unless($outlet->id === $request->user()->outlet_id && $outlet->company_id === $request->user()->company_id, 403, 'Katalog cabang lain tidak dapat diakses.');

        $today = today()->toDateString();
        $activePromotions = DB::table('product_promotions as pp')
            ->join('promotions as promo', 'promo.id', '=', 'pp.promotion_id')
            ->where('pp.company_id', $outlet->company_id)
            ->where('promo.is_active', true)
            ->whereNull('pp.deleted_at')
            ->whereNull('promo.deleted_at')
            ->whereDate('promo.effective_from', '<=', $today)
            ->where(fn ($query) => $query->whereNull('promo.effective_until')->orWhereDate('promo.effective_until', '>=', $today))
            ->select('pp.product_id', 'pp.promo_price', 'promo.name as promotion_name');

        $products = DB::table('products as p')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->leftJoin('product_variants as pv', function ($join) {
                $join->on('pv.product_id', '=', 'p.id')
                    ->where('pv.name', '=', 'S')
                    ->where('pv.is_active', '=', true);
            })
            ->leftJoinSub($activePromotions, 'active_promo', fn ($join) => $join->on('active_promo.product_id', '=', 'p.id'))
            ->where('p.company_id', $outlet->company_id)
            ->where('p.is_active', true)
            ->where('p.product_type', 'menu')
            ->whereNull('p.deleted_at')
            ->where(fn ($query) => $query->whereNull('c.id')->orWhere(fn ($category) => $category->where('c.is_active', true)->whereNull('c.deleted_at')))
            ->orderBy('c.name')
            ->orderBy('p.name')
            ->get([
                'p.id', 'p.sku', 'p.name', 'p.image_path', 'p.selling_price',
                'pv.selling_price as variant_selling_price',
                'c.id as category_id', 'c.name as category_name',
                'active_promo.promo_price', 'active_promo.promotion_name',
            ])
            ->map(function ($product) {
                $variantPrice = (float) ($product->variant_selling_price ?? 0);
                $normalPrice = $variantPrice > 0 ? $variantPrice : (float) $product->selling_price;
                $promoPrice = $product->promo_price === null ? null : (float) $product->promo_price;

                return [
                    'id' => $product->id,
                    'product_type' => 'ala_carte',
                    'sku' => $product->sku,
                    'name' => $product->name,
                    'category' => $product->category_name ?: 'Lainnya',
                    'category_id' => $product->category_id,
                    'price' => $promoPrice ?? $normalPrice,
                    'normal_price' => $normalPrice,
                    'image_url' => $product->image_path ? asset('storage/'.$product->image_path) : null,
                    'promotion_name' => $product->promotion_name,
                ];
            });

        $variants = DB::table('product_variants')
            ->whereIn('product_id', $products->pluck('id'))
            ->where('is_active', true)
            ->orderByRaw("CASE name WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 ELSE 4 END")
            ->get(['id', 'product_id', 'sku', 'name', 'selling_price'])
            ->groupBy('product_id');
        $products = $products->map(function ($product) use ($variants) {
            $product['variants'] = $variants->get($product['id'], collect())->map(function ($variant) use ($product) {
                $variantPrice = (float) $variant->selling_price;
                return [
                    'id' => $variant->id,
                    'sku' => $variant->sku,
                    'name' => $variant->name,
                    'price' => $variantPrice > 0 ? $variantPrice : (float) $product['normal_price'],
                ];
            })->values();
            return $product;
        });

        $recipeIngredients = DB::table('recipes as r')
            ->join('recipe_items as ri', 'ri.recipe_id', '=', 'r.id')
            ->join('materials as m', 'm.id', '=', 'ri.material_id')
            ->join('ingredient_modifiers as im', function ($join) use ($outlet) {
                $join->on('im.material_id', '=', 'm.id')
                    ->where('im.company_id', '=', $outlet->company_id)
                    ->where('im.is_active', '=', true)
                    ->whereNull('im.deleted_at');
            })
            ->whereIn('r.product_id', $products->pluck('id'))
            ->where('r.is_active', true)
            ->where('m.is_active', true)
            ->whereNull('r.deleted_at')
            ->whereNull('m.deleted_at')
            ->orderBy('m.name')
            ->get(['r.product_id', 'm.id', 'im.name'])
            ->groupBy('product_id');

        $products = $products->map(function ($product) use ($recipeIngredients) {
            $product['removable_ingredients'] = $recipeIngredients->get($product['id'], collect())
                ->unique('id')
                ->map(fn ($ingredient) => ['id' => $ingredient->id, 'name' => $ingredient->name])
                ->values();
            return $product;
        });

        $bundles = DB::table('product_bundles as b')
            ->where('b.company_id', $outlet->company_id)
            ->where('b.is_active', true)
            ->whereNull('b.deleted_at')
            ->whereDate('b.effective_from', '<=', $today)
            ->where(fn ($query) => $query->whereNull('b.effective_until')->orWhereDate('b.effective_until', '>=', $today))
            ->orderBy('b.name')
            ->get(['b.id', 'b.sku', 'b.name', 'b.selling_price'])
            ->map(function ($bundle) {
                $items = DB::table('product_bundle_items as bi')
                    ->join('products as p', 'p.id', '=', 'bi.product_id')
                    ->where('bi.product_bundle_id', $bundle->id)
                    ->orderBy('p.name')
                    ->get(['p.name', 'bi.quantity', 'bi.unit_price_snapshot']);

                return [
                    'id' => 'bundle:'.$bundle->id,
                    'product_type' => 'bundle',
                    'sku' => $bundle->sku,
                    'name' => $bundle->name,
                    'category' => 'Paket Hemat',
                    'category_id' => null,
                    'price' => (float) $bundle->selling_price,
                    'normal_price' => (float) $items->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_price_snapshot),
                    'image_url' => null,
                    'promotion_name' => null,
                    'description' => $items->map(fn ($item) => rtrim(rtrim((string) $item->quantity, '0'), '.').'× '.$item->name)->join(' + '),
                    'removable_ingredients' => [],
                ];
            });

        $catalog = $products->concat($bundles)->values();

        $addOns = DB::table('add_ons')
            ->where('company_id', $outlet->company_id)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'price'])
            ->map(fn ($addOn) => [
                'id' => $addOn->id,
                'code' => $addOn->code,
                'name' => $addOn->name,
                'price' => (float) $addOn->price,
            ]);

        $tables = DB::table('dining_tables')
            ->where('outlet_id', $outlet->id)
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->orderBy('table_number')
            ->get(['id', 'table_number', 'code', 'name', 'capacity', 'status']);

        return response()->json([
            'outlet' => ['id' => $outlet->id, 'code' => $outlet->code, 'name' => $outlet->name],
            'categories' => $products->pluck('category')->unique()->values(),
            'products' => $catalog,
            'add_ons' => $addOns,
            'tables' => $tables,
        ])->header('Cache-Control', 'no-store');
    }
}
