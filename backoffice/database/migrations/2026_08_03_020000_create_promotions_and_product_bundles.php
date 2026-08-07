<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30);
            $table->string('name', 150);
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 18, 2);
            $table->date('effective_from');
            $table->date('effective_until');
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();
            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'effective_from', 'effective_until']);
        });
        Schema::create('product_promotions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('promotion_id')->constrained()->restrictOnDelete();
            $table->decimal('original_price', 18, 2);
            $table->decimal('promo_price', 18, 2);
            $table->softDeletes();
            $table->timestamps();
            $table->unique(['product_id', 'promotion_id']);
        });
        Schema::create('product_bundles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 40);
            $table->string('name', 180);
            $table->decimal('selling_price', 18, 2);
            $table->date('effective_from');
            $table->date('effective_until');
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();
            $table->unique(['company_id', 'sku']);
        });
        Schema::create('product_bundle_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignUuid('product_bundle_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 18, 4);
            $table->decimal('unit_price_snapshot', 18, 2);
            $table->timestamps();
            $table->unique(['product_bundle_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_bundle_items');
        Schema::dropIfExists('product_bundles');
        Schema::dropIfExists('product_promotions');
        Schema::dropIfExists('promotions');
    }
};
