<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private array $tables = [
        'outlets', 'categories', 'positions', 'products', 'material_categories',
        'materials', 'item_categories', 'units', 'suppliers', 'warehouses',
        'kitchen_stations', 'dining_tables', 'recipes', 'product_price_snapshots',
        'purchase_orders', 'goods_receipts', 'inventory_movements',
    ];

    public function up(): void
    {
        foreach ($this->tables as $name) {
            if (Schema::hasTable($name) && !Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->softDeletes());
            }
        }
        Schema::create('soft_delete_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('source_table', 100);
            $table->string('source_id', 100);
            $table->json('data_snapshot');
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestampTz('deleted_at');
            $table->timestampTz('restored_at')->nullable();
            $table->foreignId('restored_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['source_table', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_delete_records');
        foreach ($this->tables as $name) {
            if (Schema::hasTable($name) && Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->dropSoftDeletes());
            }
        }
    }
};
