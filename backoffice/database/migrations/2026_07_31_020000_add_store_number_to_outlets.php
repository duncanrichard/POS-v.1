<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('outlets', function (Blueprint $table) {
            $table->unsignedInteger('store_number')->nullable()->after('company_id');
        });

        DB::table('outlets')->orderBy('company_id')->orderBy('created_at')->get()
            ->groupBy('company_id')
            ->each(function ($stores) {
                foreach ($stores->values() as $index => $store) {
                    DB::table('outlets')->where('id', $store->id)->update(['store_number' => $index + 1]);
                }
            });

        Schema::table('outlets', function (Blueprint $table) {
            $table->unique(['company_id', 'store_number']);
        });
    }

    public function down(): void
    {
        Schema::table('outlets', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'store_number']);
            $table->dropColumn('store_number');
        });
    }
};
