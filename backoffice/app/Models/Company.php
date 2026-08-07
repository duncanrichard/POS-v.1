<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends BaseUuidModel
{
    public function outlets(): HasMany
    {
        return $this->hasMany(Outlet::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
