<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        DB::table('products')->where('product_type', 'menu')->orderBy('id')->each(function ($product) {
            foreach (['S', 'M', 'L'] as $size) {
                if (!DB::table('product_variants')->where('product_id', $product->id)->where('name', $size)->exists()) {
                    DB::table('product_variants')->insert([
                        'id' => (string) Str::uuid(),
                        'product_id' => $product->id,
                        'sku' => $product->sku.'-'.$size,
                        'name' => $size,
                        'price_delta' => 0,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            $smallVariantId = DB::table('product_variants')->where('product_id', $product->id)
                ->where('name', 'S')->value('id');
            DB::table('recipes')->where('product_id', $product->id)->whereNull('variant_id')
                ->update(['variant_id' => $smallVariantId, 'updated_at' => now()]);
        });
    }

    public function down(): void
    {
        // Variant dan resep mungkin sudah digunakan transaksi setelah migrasi.
        // Data sengaja dipertahankan agar rollback tidak menghapus referensi bisnis.
    }
};
