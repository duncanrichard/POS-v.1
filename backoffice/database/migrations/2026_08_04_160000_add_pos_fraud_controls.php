<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('outlet_settings', fn (Blueprint $table) => $table->decimal('tax_rate', 8, 4)->default(11)->after('tax_inclusive'));
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('cashier_id')->nullable()->after('outlet_id')->constrained('users')->nullOnDelete();
            $table->string('client_order_id', 100)->nullable()->after('order_number');
            $table->string('idempotency_key', 160)->nullable()->after('client_order_id');
            $table->text('void_reason')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->unique(['outlet_id', 'idempotency_key'], 'orders_outlet_idempotency_unique');
            $table->unique(['outlet_id', 'client_order_id'], 'orders_outlet_client_unique');
        });
        Schema::create('pos_audit_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignUuid('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('outlet_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 80); $table->string('entity_type', 80); $table->string('entity_id', 100)->nullable();
            $table->string('request_id', 100)->nullable(); $table->string('ip_address', 45)->nullable();
            $table->json('before_data')->nullable(); $table->json('after_data')->nullable(); $table->json('risk_flags')->nullable();
            $table->timestampsTz();
            $table->index(['outlet_id', 'created_at']); $table->index(['event', 'created_at']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('pos_audit_logs');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_outlet_idempotency_unique'); $table->dropUnique('orders_outlet_client_unique');
            $table->dropConstrainedForeignId('cashier_id'); $table->dropConstrainedForeignId('voided_by');
            $table->dropColumn(['client_order_id', 'idempotency_key', 'void_reason', 'voided_at']);
        });
        Schema::table('outlet_settings', fn (Blueprint $table) => $table->dropColumn('tax_rate'));
    }
};
