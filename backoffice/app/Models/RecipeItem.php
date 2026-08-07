<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeItem extends BaseUuidModel
{
    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
