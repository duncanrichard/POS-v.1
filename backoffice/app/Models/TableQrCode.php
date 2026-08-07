<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TableQrCode extends BaseUuidModel
{
    public function diningTable(): BelongsTo
    {
        return $this->belongsTo(DiningTable::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'rotated_at' => 'datetime'];
    }
}
