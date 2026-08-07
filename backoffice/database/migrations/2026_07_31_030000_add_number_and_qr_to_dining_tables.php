<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('dining_tables', function (Blueprint $table) {
            $table->unsignedInteger('table_number')->nullable()->after('outlet_id');
        });

        DB::table('dining_tables')->orderBy('outlet_id')->orderBy('created_at')->get()
            ->groupBy('outlet_id')
            ->each(function ($tables) {
                foreach ($tables->values() as $index => $table) {
                    DB::table('dining_tables')->where('id', $table->id)->update(['table_number' => $index + 1]);
                }
            });

        Schema::table('dining_tables', function (Blueprint $table) {
            $table->unique(['outlet_id', 'table_number']);
        });

        Schema::create('table_qr_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('dining_table_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->text('token_encrypted');
            $table->boolean('is_active')->default(true);
            $table->timestampTz('rotated_at')->nullable();
            $table->timestamps();
            $table->index(['dining_table_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('table_qr_codes');
        Schema::table('dining_tables', function (Blueprint $table) {
            $table->dropUnique(['outlet_id', 'table_number']);
            $table->dropColumn('table_number');
        });
    }
};
