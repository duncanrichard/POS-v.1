<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('material_prices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('material_id')->constrained()->cascadeOnDelete();
            $table->decimal('price', 18, 6);
            $table->date('effective_from');
            $table->date('effective_until')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['company_id', 'effective_from']);
            $table->index(['material_id', 'effective_from', 'effective_until']);
        });

        Schema::create('material_price_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('material_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('material_price_id')->nullable()->constrained('material_prices')->nullOnDelete();
            $table->string('action', 20);
            $table->decimal('price', 18, 6);
            $table->date('effective_from');
            $table->date('effective_until')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['material_id', 'created_at']);
        });

        // Jadikan harga master lama sebagai periode awal agar data existing tidak hilang.
        DB::table('materials')->where('average_cost', '>', 0)->orderBy('id')->each(function ($material) {
            $priceId = (string) Str::uuid();
            $now = now();
            DB::table('material_prices')->insert([
                'id' => $priceId, 'company_id' => $material->company_id, 'material_id' => $material->id,
                'price' => $material->average_cost, 'effective_from' => $now->toDateString(),
                'effective_until' => null, 'created_by' => null, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('material_price_snapshots')->insert([
                'id' => (string) Str::uuid(), 'company_id' => $material->company_id,
                'material_id' => $material->id, 'material_price_id' => $priceId, 'action' => 'migrated',
                'price' => $material->average_cost, 'effective_from' => $now->toDateString(),
                'effective_until' => null, 'created_by' => null, 'created_at' => $now, 'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_price_snapshots');
        Schema::dropIfExists('material_prices');
    }
};
