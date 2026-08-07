<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KitchenTicket extends BaseUuidModel
{
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(OrderBatch::class, 'order_batch_id');
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(KitchenStation::class, 'kitchen_station_id');
    }
}
