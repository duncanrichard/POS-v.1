<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach ([
            'categories', 'products', 'material_categories', 'materials',
            'item_categories', 'suppliers', 'warehouses', 'kitchen_stations',
        ] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) =>
                $blueprint->index(['outlet_id', 'name'], $table.'_outlet_name_idx'));
        }

        Schema::table('dining_tables', fn (Blueprint $table) =>
            $table->index(['outlet_id', 'table_number'], 'dining_tables_outlet_number_idx'));
        Schema::table('recipes', fn (Blueprint $table) =>
            $table->index('product_id', 'recipes_product_idx'));
        Schema::table('recipe_items', fn (Blueprint $table) =>
            $table->index(['recipe_id', 'material_id'], 'recipe_items_recipe_material_idx'));
        Schema::table('purchase_orders', fn (Blueprint $table) =>
            $table->index(['outlet_id', 'created_at'], 'purchase_orders_outlet_created_idx'));
        Schema::table('inventory_balances', fn (Blueprint $table) =>
            $table->index(['warehouse_id', 'product_id'], 'inventory_balances_warehouse_product_idx'));
    }

    public function down(): void
    {
        foreach ([
            'categories', 'products', 'material_categories', 'materials',
            'item_categories', 'suppliers', 'warehouses', 'kitchen_stations',
        ] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) =>
                $blueprint->dropIndex($table.'_outlet_name_idx'));
        }
        Schema::table('dining_tables', fn (Blueprint $table) => $table->dropIndex('dining_tables_outlet_number_idx'));
        Schema::table('recipes', fn (Blueprint $table) => $table->dropIndex('recipes_product_idx'));
        Schema::table('recipe_items', fn (Blueprint $table) => $table->dropIndex('recipe_items_recipe_material_idx'));
        Schema::table('purchase_orders', fn (Blueprint $table) => $table->dropIndex('purchase_orders_outlet_created_idx'));
        Schema::table('inventory_balances', fn (Blueprint $table) => $table->dropIndex('inventory_balances_warehouse_product_idx'));
    }
};
