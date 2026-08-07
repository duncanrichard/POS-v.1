<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('purchase_order_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->string('title', 150);
            $table->string('message', 500);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['company_id', 'read_at', 'created_at'], 'po_notifications_unread_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_notifications');
    }
};
