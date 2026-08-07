<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_bundles', function (Blueprint $table) {
            $table->date('effective_until')->nullable()->change();
        });
        Schema::table('product_promotions', function (Blueprint $table) {
            $table->foreignUuid('product_id')->nullable()->change();
            $table->foreignUuid('product_bundle_id')->nullable()->after('product_id')->constrained('product_bundles')->restrictOnDelete();
            $table->unique(['product_bundle_id', 'promotion_id'], 'bundle_promotion_unique');
        });
    }

    public function down(): void
    {
        Schema::table('product_promotions', function (Blueprint $table) {
            $table->dropUnique('bundle_promotion_unique');
            $table->dropConstrainedForeignId('product_bundle_id');
        });
        Schema::table('product_bundles', function (Blueprint $table) {
            $table->date('effective_until')->nullable(false)->change();
        });
    }
};
