<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('item_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30);
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['outlet_id', 'code']);
        });
        Schema::table('materials', function (Blueprint $table) {
            $table->foreignUuid('item_category_id')->nullable()->after('material_category_id')
                ->constrained('item_categories')->nullOnDelete();
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('invoice_number', 60)->nullable()->after('po_number');
            $table->unique(['outlet_id', 'invoice_number']);
        });
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->uuid('product_id')->nullable()->change();
            $table->foreignUuid('material_id')->nullable()->after('product_id')
                ->constrained('materials')->restrictOnDelete();
            $table->foreignUuid('item_category_id')->nullable()->after('material_id')
                ->constrained('item_categories')->nullOnDelete();
        });

        foreach (DB::table('material_categories')->get() as $category) {
            $id = (string) Str::uuid();
            DB::table('item_categories')->insert([
                'id' => $id, 'company_id' => $category->company_id, 'outlet_id' => $category->outlet_id,
                'code' => 'CAT-'.strtoupper(substr(str_replace(' ', '', $category->name), 0, 12)),
                'name' => $category->name, 'description' => 'Kategori barang hasil migrasi.',
                'is_active' => $category->is_active, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('materials')->where('material_category_id', $category->id)
                ->update(['item_category_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('item_category_id');
            $table->dropConstrainedForeignId('material_id');
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropUnique(['outlet_id', 'invoice_number']);
            $table->dropColumn('invoice_number');
        });
        Schema::table('materials', fn (Blueprint $table) => $table->dropConstrainedForeignId('item_category_id'));
        Schema::dropIfExists('item_categories');
    }
};
