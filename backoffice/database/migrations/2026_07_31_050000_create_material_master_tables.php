<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('material_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('material_group', 30)->default('raw');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['outlet_id', 'name']);
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('material_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('base_unit_id')->constrained('units');
            $table->string('sku', 60);
            $table->string('name', 180);
            $table->decimal('average_cost', 18, 6)->default(0);
            $table->decimal('minimum_stock', 18, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['outlet_id', 'sku']);
        });

        // Pindahkan master bahan lama agar data yang sudah dibuat tidak hilang.
        $legacyCategories = DB::table('categories')->where('type', 'ingredient')->get();
        foreach ($legacyCategories as $category) {
            if (!$category->outlet_id) {
                continue;
            }
            DB::table('material_categories')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $category->company_id,
                'outlet_id' => $category->outlet_id,
                'name' => $category->name,
                'material_group' => 'raw',
                'is_active' => $category->is_active,
                'created_at' => $category->created_at,
                'updated_at' => $category->updated_at,
            ]);
        }

        $legacyMaterials = DB::table('products')
            ->whereIn('product_type', ['ingredient', 'packaging'])
            ->get();
        foreach ($legacyMaterials as $material) {
            if (!$material->outlet_id) {
                continue;
            }
            $categoryName = $material->category_id
                ? DB::table('categories')->where('id', $material->category_id)->value('name')
                : null;
            $newCategoryId = $categoryName
                ? DB::table('material_categories')
                    ->where('outlet_id', $material->outlet_id)
                    ->where('name', $categoryName)
                    ->value('id')
                : null;

            DB::table('materials')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $material->company_id,
                'outlet_id' => $material->outlet_id,
                'material_category_id' => $newCategoryId,
                'base_unit_id' => $material->base_unit_id,
                'sku' => $material->sku,
                'name' => $material->name,
                'average_cost' => $material->average_cost,
                'minimum_stock' => 0,
                'is_active' => $material->is_active,
                'created_at' => $material->created_at,
                'updated_at' => $material->updated_at,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
        Schema::dropIfExists('material_categories');
    }
};
