<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->string('code', 30)->unique(); $t->string('name', 150);
            $t->string('timezone', 50)->default('Asia/Jakarta'); $t->char('currency_code', 3)->default('IDR');
            $t->boolean('is_active')->default(true); $t->timestamps();
        });
        Schema::create('outlets', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $t->string('code', 30); $t->string('name', 150); $t->text('address')->nullable();
            $t->string('timezone', 50)->default('Asia/Jakarta'); $t->string('status', 30)->default('active'); $t->timestamps();
            $t->unique(['company_id','code']); $t->index(['company_id','status']);
        });
        Schema::create('outlet_settings', function (Blueprint $t) {
            $t->foreignUuid('outlet_id')->primary()->constrained()->cascadeOnDelete();
            $t->boolean('tax_inclusive')->default(false); $t->boolean('require_qr_order_approval')->default(false);
            $t->boolean('allow_negative_stock')->default(false); $t->string('stock_deduction_stage',30)->default('sent_to_kitchen');
            $t->boolean('prepaid_only')->default(false); $t->decimal('default_service_charge',8,4)->default(0); $t->timestamps();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->uuid('company_id')->nullable()->after('id'); $t->string('phone',30)->nullable();
            $t->string('status',30)->default('active'); $t->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
        });
        Schema::create('dining_tables', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->string('code',30); $t->string('name',80); $t->unsignedSmallInteger('capacity')->default(2);
            $t->string('status',30)->default('available'); $t->timestamps(); $t->unique(['outlet_id','code']);
        });
        Schema::create('table_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('dining_table_id')->nullable()->constrained()->nullOnDelete(); $t->string('session_number',60);
            $t->string('status',30)->default('open'); $t->timestampTz('opened_at'); $t->timestampTz('closed_at')->nullable();
            $t->timestamps(); $t->unique(['outlet_id','session_number']); $t->index(['dining_table_id','status']);
        });
        Schema::create('categories', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $t->string('name',120); $t->string('type',30)->default('menu'); $t->boolean('is_active')->default(true); $t->timestamps();
        });
        Schema::create('units', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->string('code',20)->unique(); $t->string('name',60); $t->string('unit_type',30); $t->timestamps();
        });
        Schema::create('products', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('category_id')->nullable()->constrained()->nullOnDelete(); $t->foreignUuid('base_unit_id')->constrained('units');
            $t->string('sku',60); $t->string('name',180); $t->string('product_type',30);
            $t->decimal('selling_price',18,2)->default(0); $t->decimal('average_cost',18,6)->default(0);
            $t->boolean('is_active')->default(true); $t->timestamps(); $t->unique(['company_id','sku']);
        });
        Schema::create('product_variants', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $t->string('sku',60); $t->string('name',120); $t->decimal('price_delta',18,2)->default(0); $t->boolean('is_active')->default(true); $t->timestamps();
            $t->unique(['product_id','sku']);
        });
        Schema::create('kitchen_stations', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->string('code',30); $t->string('name',100); $t->unsignedSmallInteger('sla_minutes')->default(15); $t->boolean('is_active')->default(true); $t->timestamps();
            $t->unique(['outlet_id','code']);
        });
        Schema::create('orders', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('table_session_id')->nullable()->constrained()->nullOnDelete(); $t->string('order_number',60);
            $t->string('order_type',30); $t->string('source',30); $t->string('production_status',30)->default('draft');
            $t->string('payment_status',30)->default('open_bill'); $t->decimal('subtotal',18,2)->default(0);
            $t->decimal('tax_total',18,2)->default(0); $t->decimal('service_total',18,2)->default(0);
            $t->decimal('discount_total',18,2)->default(0); $t->decimal('grand_total',18,2)->default(0);
            $t->decimal('paid_total',18,2)->default(0); $t->timestampTz('ordered_at'); $t->timestamps();
            $t->unique(['outlet_id','order_number']); $t->index(['outlet_id','ordered_at']); $t->index(['payment_status','production_status']);
        });
        Schema::create('order_batches', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->string('batch_number',60); $t->unsignedSmallInteger('sequence')->default(1); $t->string('status',30)->default('draft');
            $t->boolean('is_additional')->default(false); $t->timestampTz('submitted_at')->nullable(); $t->timestamps(); $t->unique(['order_id','batch_number']);
        });
        Schema::create('order_items', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('order_batch_id')->constrained()->cascadeOnDelete(); $t->foreignUuid('product_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignUuid('variant_id')->nullable()->constrained('product_variants')->nullOnDelete(); $t->foreignUuid('kitchen_station_id')->nullable()->constrained()->nullOnDelete();
            $t->string('product_name_snapshot',180); $t->string('variant_name_snapshot',120)->nullable(); $t->decimal('quantity',18,4);
            $t->decimal('unit_price',18,2); $t->decimal('line_total',18,2); $t->json('modifier_snapshot')->nullable();
            $t->text('notes')->nullable(); $t->string('production_status',30)->default('queued'); $t->timestamps(); $t->index(['order_batch_id','kitchen_station_id']);
        });
        Schema::create('kitchen_tickets', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('order_batch_id')->constrained()->cascadeOnDelete(); $t->foreignUuid('kitchen_station_id')->constrained()->cascadeOnDelete();
            $t->string('ticket_number',60); $t->string('status',30)->default('queued'); $t->unsignedSmallInteger('priority')->default(0);
            $t->timestampTz('queued_at'); $t->timestampTz('ready_at')->nullable(); $t->timestamps();
            $t->unique(['kitchen_station_id','ticket_number']); $t->unique(['order_batch_id','kitchen_station_id']);
        });
        Schema::create('kitchen_ticket_items', function (Blueprint $t) {
            $t->foreignUuid('kitchen_ticket_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('order_item_id')->constrained()->cascadeOnDelete(); $t->primary(['kitchen_ticket_id','order_item_id']);
        });
        Schema::create('payments', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->string('payment_number',60)->unique(); $t->string('method',30); $t->string('provider')->nullable();
            $t->string('external_reference')->nullable(); $t->string('status',30)->default('pending'); $t->decimal('amount',18,2);
            $t->string('idempotency_key',160)->unique(); $t->timestampTz('paid_at')->nullable(); $t->json('metadata')->nullable(); $t->timestamps();
            $t->index(['order_id','status']);
        });
        Schema::create('warehouses', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->string('code',30); $t->string('name',120); $t->boolean('is_active')->default(true); $t->timestamps(); $t->unique(['outlet_id','code']);
        });
        Schema::create('inventory_movements', function (Blueprint $t) {
            $t->bigIncrements('id'); $t->uuid('movement_uuid')->unique(); $t->foreignUuid('warehouse_id')->constrained()->restrictOnDelete();
            $t->string('movement_type',40); $t->string('reference_type',80); $t->uuid('reference_id'); $t->string('idempotency_key',160)->unique();
            $t->timestampTz('posted_at'); $t->json('metadata')->nullable(); $t->timestamps(); $t->unique(['reference_type','reference_id','movement_type']);
        });
        Schema::create('inventory_movement_items', function (Blueprint $t) {
            $t->bigIncrements('id'); $t->foreignId('inventory_movement_id')->constrained()->restrictOnDelete();
            $t->foreignUuid('product_id')->constrained()->restrictOnDelete(); $t->foreignUuid('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $t->foreignUuid('unit_id')->constrained('units'); $t->string('direction',3); $t->decimal('quantity',18,4); $t->decimal('unit_cost',18,6)->default(0);
            $t->index(['product_id','inventory_movement_id']);
        });
        Schema::create('inventory_balances', function (Blueprint $t) {
            $t->foreignUuid('warehouse_id')->constrained()->cascadeOnDelete(); $t->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete(); $t->decimal('quantity_on_hand',18,4)->default(0);
            $t->decimal('quantity_reserved',18,4)->default(0); $t->decimal('average_cost',18,6)->default(0); $t->timestamps();
            $t->unique(['warehouse_id','product_id','variant_id'],'inventory_balance_unique');
        });
        Schema::create('recipes', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete(); $t->decimal('yield_quantity',18,4)->default(1);
            $t->foreignUuid('yield_unit_id')->constrained('units'); $t->unsignedSmallInteger('version')->default(1); $t->boolean('is_active')->default(true); $t->timestamps();
        });
        Schema::create('recipe_items', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('recipe_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('ingredient_product_id')->constrained('products')->restrictOnDelete(); $t->foreignUuid('unit_id')->constrained('units');
            $t->decimal('quantity',18,4); $t->decimal('waste_percentage',8,4)->default(0); $t->timestamps(); $t->unique(['recipe_id','ingredient_product_id']);
        });
        Schema::create('suppliers', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $t->string('code',30); $t->string('name',150); $t->string('phone',30)->nullable(); $t->string('email')->nullable();
            $t->boolean('is_active')->default(true); $t->timestamps(); $t->unique(['company_id','code']);
        });
        Schema::create('purchase_orders', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('supplier_id')->constrained()->restrictOnDelete(); $t->string('po_number',60); $t->string('status',30)->default('draft');
            $t->decimal('grand_total',18,2)->default(0); $t->date('expected_date')->nullable(); $t->timestamps(); $t->unique(['outlet_id','po_number']);
        });
        Schema::create('purchase_order_items', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('purchase_order_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('product_id')->constrained()->restrictOnDelete(); $t->foreignUuid('unit_id')->constrained('units');
            $t->decimal('ordered_qty',18,4); $t->decimal('received_qty',18,4)->default(0); $t->decimal('unit_cost',18,6); $t->decimal('line_total',18,2); $t->timestamps();
        });
        Schema::create('goods_receipts', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->foreignUuid('purchase_order_id')->constrained()->restrictOnDelete();
            $t->foreignUuid('warehouse_id')->constrained()->restrictOnDelete(); $t->string('receipt_number',60)->unique();
            $t->string('status',30)->default('draft'); $t->foreignId('posted_movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $t->timestampTz('received_at')->nullable(); $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['goods_receipts','purchase_order_items','purchase_orders','suppliers','recipe_items','recipes','inventory_balances','inventory_movement_items','inventory_movements','warehouses','payments','kitchen_ticket_items','kitchen_tickets','order_items','order_batches','orders','kitchen_stations','product_variants','products','units','categories','table_sessions','dining_tables'] as $table) Schema::dropIfExists($table);
        Schema::table('users', function (Blueprint $t) { $t->dropForeign(['company_id']); $t->dropColumn(['company_id','phone','status']); });
        Schema::dropIfExists('outlet_settings'); Schema::dropIfExists('outlets'); Schema::dropIfExists('companies');
    }
};
