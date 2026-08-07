<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends BaseUuidModel
{
    use SoftDeletes;

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
