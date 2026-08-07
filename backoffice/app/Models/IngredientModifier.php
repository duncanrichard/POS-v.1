<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class IngredientModifier extends BaseUuidModel
{
    use SoftDeletes;

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
