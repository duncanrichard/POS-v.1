<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IngredientModifierSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('materials')
            ->whereNull('deleted_at')
            ->where(function ($query) {
                $query->whereRaw('lower(name) like ?', ['%ketchup%'])
                    ->orWhereRaw('lower(name) like ?', ['%pickle%']);
            })
            ->get(['id', 'company_id', 'name'])
            ->each(function ($material) {
                DB::table('ingredient_modifiers')->updateOrInsert(
                    ['company_id' => $material->company_id, 'material_id' => $material->id],
                    [
                        'id' => DB::table('ingredient_modifiers')
                            ->where('company_id', $material->company_id)
                            ->where('material_id', $material->id)
                            ->value('id') ?: (string) Str::uuid(),
                        'name' => 'Tanpa '.$material->name,
                        'is_active' => true,
                        'deleted_at' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                );
            });
    }
}
