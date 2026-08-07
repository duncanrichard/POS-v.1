<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->decimal('buffer_stock', 18, 4)->default(0)->after('minimum_stock');
            $table->decimal('stock_barrier', 18, 4)->default(0)->after('buffer_stock');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['buffer_stock', 'stock_barrier']);
        });
    }
};
