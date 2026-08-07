<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletSetting extends BaseUuidModel
{
    protected $primaryKey = 'outlet_id';

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    protected function casts(): array
    {
        return ['tax_inclusive' => 'boolean', 'require_qr_order_approval' => 'boolean', 'allow_negative_stock' => 'boolean'];
    }
}
