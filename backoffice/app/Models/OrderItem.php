<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends BaseUuidModel
{
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(OrderBatch::class, 'order_batch_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function kitchenStation(): BelongsTo
    {
        return $this->belongsTo(KitchenStation::class);
    }

    protected function casts(): array
    {
        return ['modifier_snapshot' => 'array', 'quantity' => 'decimal:4', 'unit_price' => 'decimal:2', 'line_total' => 'decimal:2'];
    }
}
