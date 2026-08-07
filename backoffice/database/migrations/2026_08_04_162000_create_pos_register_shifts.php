<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pos_registers', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->foreignUuid('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30); $table->string('name', 100); $table->boolean('is_active')->default(true); $table->timestampsTz();
            $table->unique(['outlet_id', 'code']);
        });
        Schema::create('pos_shifts', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->foreignUuid('outlet_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('register_id')->constrained('pos_registers')->restrictOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete(); $table->string('shift_number', 60)->unique();
            $table->string('status', 20)->default('open'); $table->decimal('opening_cash', 18, 2)->default(0);
            $table->decimal('expected_cash', 18, 2)->nullable(); $table->decimal('actual_cash', 18, 2)->nullable();
            $table->decimal('cash_variance', 18, 2)->nullable(); $table->text('closing_note')->nullable();
            $table->timestampTz('opened_at'); $table->timestampTz('closed_at')->nullable(); $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz(); $table->index(['outlet_id', 'status']); $table->index(['cashier_id', 'status']);
        });
        Schema::table('orders', fn (Blueprint $table) => $table->foreignUuid('shift_id')->nullable()->after('cashier_id')->constrained('pos_shifts')->restrictOnDelete());
        Schema::table('payments', fn (Blueprint $table) => $table->foreignUuid('shift_id')->nullable()->after('order_id')->constrained('pos_shifts')->restrictOnDelete());

        DB::table('outlets')->where('status', 'active')->orderBy('id')->each(function ($outlet) {
            DB::table('pos_registers')->insert(['id' => (string) Str::uuid(), 'outlet_id' => $outlet->id, 'code' => 'REG-01',
                'name' => 'Register 01', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        });
    }
    public function down(): void
    {
        Schema::table('payments', fn (Blueprint $table) => $table->dropConstrainedForeignId('shift_id'));
        Schema::table('orders', fn (Blueprint $table) => $table->dropConstrainedForeignId('shift_id'));
        Schema::dropIfExists('pos_shifts'); Schema::dropIfExists('pos_registers');
    }
};
