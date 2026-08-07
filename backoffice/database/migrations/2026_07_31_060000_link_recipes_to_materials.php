<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('recipe_items', function (Blueprint $table) {
            $table->uuid('ingredient_product_id')->nullable()->change();
            $table->foreignUuid('material_id')->nullable()->after('ingredient_product_id')
                ->constrained('materials')->restrictOnDelete();
            $table->dropUnique(['recipe_id', 'ingredient_product_id']);
            $table->unique(['recipe_id', 'material_id']);
        });
    }

    public function down(): void
    {
        Schema::table('recipe_items', function (Blueprint $table) {
            $table->dropUnique(['recipe_id', 'material_id']);
            $table->dropConstrainedForeignId('material_id');
        });
    }
};
