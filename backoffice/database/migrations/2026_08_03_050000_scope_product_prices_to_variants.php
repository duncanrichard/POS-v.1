<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->decimal('selling_price', 18, 2)->default(0)->after('price_delta');
        });
        Schema::table('product_price_snapshots', function (Blueprint $table) {
            $table->foreignUuid('variant_id')->nullable()->after('product_id')
                ->constrained('product_variants')->nullOnDelete();
            $table->index(['variant_id', 'effective_from'], 'product_variant_price_period_idx');
        });
        DB::table('product_price_snapshots as ps')->whereNull('variant_id')->orderBy('id')->each(function ($price) {
            $variantId = DB::table('recipes')->where('id', $price->recipe_id)->value('variant_id');
            DB::table('product_price_snapshots')->where('id', $price->id)->update(['variant_id' => $variantId]);
        });
    }

    public function down(): void
    {
        Schema::table('product_price_snapshots', function (Blueprint $table) {
            $table->dropIndex('product_variant_price_period_idx');
            $table->dropConstrainedForeignId('variant_id');
        });
        Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn('selling_price'));
    }
};
