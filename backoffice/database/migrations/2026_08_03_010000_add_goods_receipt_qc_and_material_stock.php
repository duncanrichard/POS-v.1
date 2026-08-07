<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->string('qc_status', 30)->default('pending')->after('status');
            $table->text('notes')->nullable()->after('qc_status');
            $table->foreignId('received_by')->nullable()->after('notes')->constrained('users')->nullOnDelete();
        });

        Schema::create('goods_receipt_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignUuid('goods_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('purchase_order_item_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('material_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('unit_id')->constrained('units')->restrictOnDelete();
            $table->decimal('ordered_qty', 18, 4);
            $table->decimal('accepted_qty', 18, 4)->default(0);
            $table->decimal('rejected_qty', 18, 4)->default(0);
            $table->string('qc_status', 30);
            $table->string('qc_note', 500)->nullable();
            $table->timestamps();
            $table->unique(['goods_receipt_id', 'purchase_order_item_id'], 'receipt_po_item_unique');
        });

        Schema::table('inventory_movement_items', function (Blueprint $table) {
            $table->uuid('product_id')->nullable()->change();
            $table->foreignUuid('material_id')->nullable()->after('variant_id')->constrained('materials')->restrictOnDelete();
        });

        Schema::create('material_inventory_balances', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignUuid('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('material_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity_on_hand', 18, 4)->default(0);
            $table->decimal('quantity_reserved', 18, 4)->default(0);
            $table->decimal('average_cost', 18, 6)->default(0);
            $table->timestamps();
            $table->unique(['warehouse_id', 'material_id'], 'material_balance_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_inventory_balances');
        Schema::table('inventory_movement_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('material_id');
            $table->uuid('product_id')->nullable(false)->change();
        });
        Schema::dropIfExists('goods_receipt_items');
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('received_by');
            $table->dropColumn(['qc_status', 'notes']);
        });
    }
};
