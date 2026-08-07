<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unit extends BaseUuidModel
{
    use SoftDeletes;

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'base_unit_id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class, 'base_unit_id');
    }
}
