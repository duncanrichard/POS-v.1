<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariant extends BaseUuidModel
{
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'selling_price' => 'decimal:2', 'price_delta' => 'decimal:2'];
    }
}
