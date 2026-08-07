<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class KitchenStation extends BaseUuidModel
{
    use SoftDeletes;

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(KitchenTicket::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
