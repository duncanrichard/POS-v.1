<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['users', 'roles', 'permissions'] as $tableName) {
            Schema::table($tableName, fn (Blueprint $table) => $table->uuid('uuid')->nullable()->unique());
            DB::table($tableName)->whereNull('uuid')->orderBy('id')->eachById(
                fn ($row) => DB::table($tableName)->where('id', $row->id)->update(['uuid' => (string) \Illuminate\Support\Str::uuid()])
            );
            DB::statement("ALTER TABLE {$tableName} ALTER COLUMN uuid SET NOT NULL");
            DB::statement("ALTER TABLE {$tableName} ALTER COLUMN uuid SET DEFAULT gen_random_uuid()");
        }
    }

    public function down(): void
    {
        foreach (['permissions', 'roles', 'users'] as $tableName) {
            Schema::table($tableName, fn (Blueprint $table) => $table->dropColumn('uuid'));
        }
    }
};
