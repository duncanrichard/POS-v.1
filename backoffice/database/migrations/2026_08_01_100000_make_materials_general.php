<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->uuid('outlet_id')->nullable()->change();
        });
        DB::table('materials')->update(['outlet_id' => null, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Outlet harus diisi kembali secara manual sebelum rollback.
    }
};
