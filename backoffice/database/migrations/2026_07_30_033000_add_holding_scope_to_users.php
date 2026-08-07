<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('outlet_id')->nullable()->after('company_id');
            $table->string('position', 80)->nullable()->after('phone');
            $table->foreign('outlet_id')->references('id')->on('outlets')->nullOnDelete();
            $table->index(['company_id', 'outlet_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['outlet_id']);
            $table->dropIndex(['company_id', 'outlet_id', 'status']);
            $table->dropColumn(['outlet_id', 'position']);
        });
    }
};
