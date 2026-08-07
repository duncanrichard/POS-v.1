<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_price_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('recipe_id')->constrained()->restrictOnDelete();
            $table->decimal('ingredient_cost', 18, 6);
            $table->decimal('hpp', 18, 6);
            $table->decimal('selling_price', 18, 2);
            $table->date('effective_from');
            $table->date('effective_until')->nullable();
            $table->json('ingredient_snapshot');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['company_id', 'effective_from']);
            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_snapshots');
    }
};
