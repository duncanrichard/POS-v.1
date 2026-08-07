<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['categories', 'products', 'suppliers'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->uuid('outlet_id')->nullable()->after('company_id');
                $table->foreign('outlet_id')->references('id')->on('outlets')->nullOnDelete();
                $table->index(['company_id', 'outlet_id']);
            });
        }

        foreach (['categories', 'products', 'suppliers'] as $tableName) {
            DB::table($tableName)->orderBy('company_id')->get()->groupBy('company_id')
                ->each(function ($records, $companyId) use ($tableName) {
                    $outletId = DB::table('outlets')->where('company_id', $companyId)->orderBy('store_number')->value('id');
                    if ($outletId) {
                        DB::table($tableName)->whereIn('id', $records->pluck('id'))->update(['outlet_id' => $outletId]);
                    }
                });
        }
    }

    public function down(): void
    {
        foreach (['categories', 'products', 'suppliers'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['outlet_id']);
                $table->dropIndex(['company_id', 'outlet_id']);
                $table->dropColumn('outlet_id');
            });
        }
    }
};
