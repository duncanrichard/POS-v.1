<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_price_snapshots', function (Blueprint $table) {
            $table->uuid('price_batch_id')->nullable()->after('id');
            $table->index(['product_id', 'price_batch_id'], 'product_price_batch_idx');
        });
        DB::table('product_price_snapshots')->orderBy('product_id')->get()
            ->groupBy(fn ($row) => $row->product_id.'|'.$row->effective_from.'|'.($row->effective_until ?? 'open'))
            ->each(function ($rows) {
                DB::table('product_price_snapshots')->whereIn('id', $rows->pluck('id'))
                    ->update(['price_batch_id' => (string) Str::uuid()]);
            });
    }

    public function down(): void
    {
        Schema::table('product_price_snapshots', function (Blueprint $table) {
            $table->dropIndex('product_price_batch_idx');
            $table->dropColumn('price_batch_id');
        });
    }
};
