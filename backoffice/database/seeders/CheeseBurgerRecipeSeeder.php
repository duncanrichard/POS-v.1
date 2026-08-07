<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CheeseBurgerRecipeSeeder extends Seeder
{
    public function run(): void
    {
        $companyId = DB::table('companies')->where('code', 'POSPHERE')->value('id');
        $outlet = $companyId
            ? DB::table('outlets')->where('company_id', $companyId)->orderBy('store_number')->first()
            : null;
        if (!$companyId || !$outlet) {
            throw new RuntimeException('Buat company POSPHERE dan minimal satu Store sebelum menjalankan seeder resep.');
        }
        $outletId = $outlet->id;

        $pcsUnitId = $this->unit('PCS', 'Pieces', 'quantity');
        $gramUnitId = $this->unit('GR', 'Gram', 'weight');
        $burgerCategoryId = DB::table('categories')->where('outlet_id', $outletId)
            ->where('name', 'Burger')->value('id') ?: (string) Str::uuid();
        DB::table('categories')->updateOrInsert(['outlet_id' => $outletId, 'name' => 'Burger'], [
            'id' => $burgerCategoryId, 'company_id' => $companyId, 'type' => 'menu',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $materialCategoryId = DB::table('material_categories')->where('outlet_id', $outletId)
            ->where('name', 'Bahan Burger')->value('id') ?: (string) Str::uuid();
        DB::table('material_categories')->updateOrInsert(
            ['outlet_id' => $outletId, 'name' => 'Bahan Burger'],
            [
                'id' => $materialCategoryId, 'company_id' => $companyId, 'material_group' => 'raw',
                'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]
        );
        $itemCategoryId = DB::table('item_categories')->where('outlet_id', $outletId)
            ->where('code', 'BRG-BURGER')->value('id') ?: (string) Str::uuid();
        DB::table('item_categories')->updateOrInsert(
            ['outlet_id' => $outletId, 'code' => 'BRG-BURGER'],
            [
                'id' => $itemCategoryId, 'company_id' => $companyId, 'name' => 'Bahan Burger',
                'description' => 'Barang pembelian untuk produksi burger.', 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]
        );

        $materialIds = [];
        foreach ([
            ['ING-BUN', 'Burger Bun', $pcsUnitId, 3500],
            ['ING-CHEESE', 'American Cheese', $pcsUnitId, 2500],
            ['ING-PICKLE', 'Pickle', $gramUnitId, 80],
            ['ING-KETCHUP', 'Ketchup', $gramUnitId, 45],
        ] as [$sku, $name, $unitId, $cost]) {
            $id = DB::table('materials')->where('outlet_id', $outletId)
                ->where('sku', $sku)->value('id') ?: (string) Str::uuid();
            DB::table('materials')->updateOrInsert(['outlet_id' => $outletId, 'sku' => $sku], [
                'id' => $id, 'company_id' => $companyId, 'material_category_id' => $materialCategoryId,
                'item_category_id' => $itemCategoryId,
                'base_unit_id' => $unitId, 'name' => $name, 'average_cost' => $cost,
                'buffer_stock' => 10, 'stock_barrier' => 20, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $materialIds[$sku] = $id;
        }

        $productId = DB::table('products')->where('company_id', $companyId)
            ->where('sku', 'MENU-CB-001')->value('id') ?: (string) Str::uuid();
        DB::table('products')->updateOrInsert(['company_id' => $companyId, 'sku' => 'MENU-CB-001'], [
            'id' => $productId, 'outlet_id' => null, 'category_id' => $burgerCategoryId,
            'base_unit_id' => $pcsUnitId, 'name' => 'Cheese Burger', 'product_type' => 'menu',
            'selling_price' => 35000, 'average_cost' => 0, 'is_active' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $recipeId = DB::table('recipes')->where('product_id', $productId)->value('id') ?: (string) Str::uuid();
        DB::table('recipes')->updateOrInsert(['product_id' => $productId], [
            'id' => $recipeId, 'variant_id' => null, 'yield_quantity' => 1,
            'yield_unit_id' => $pcsUnitId, 'version' => 1, 'is_active' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('recipe_items')->where('recipe_id', $recipeId)->delete();
        foreach ([
            ['ING-BUN', 1, $pcsUnitId],
            ['ING-CHEESE', 1, $pcsUnitId],
            ['ING-PICKLE', 2, $gramUnitId],
            ['ING-KETCHUP', 4, $gramUnitId],
        ] as [$sku, $quantity, $unitId]) {
            DB::table('recipe_items')->insert([
                'id' => (string) Str::uuid(), 'recipe_id' => $recipeId,
                'ingredient_product_id' => null, 'material_id' => $materialIds[$sku],
                'unit_id' => $unitId, 'quantity' => $quantity, 'waste_percentage' => 0,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    private function unit(string $code, string $name, string $type): string
    {
        $id = DB::table('units')->where('code', $code)->value('id') ?: (string) Str::uuid();
        DB::table('units')->updateOrInsert(['code' => $code], [
            'id' => $id, 'name' => $name, 'unit_type' => $type,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }
}
