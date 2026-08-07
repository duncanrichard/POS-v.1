<?php

namespace App\Http\Controllers\MasterData;

use App\Models\IngredientModifier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IngredientModifierController extends MasterDataResourceController
{
    protected string $modelClass = IngredientModifier::class;

    protected ?string $scopeColumn = 'company_id';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['material_id' => ['required', Rule::exists('materials', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at'), Rule::unique('ingredient_modifiers', 'material_id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->ignore($id, 'id')], 'name' => ['required', 'string', 'max:120'], 'is_active' => ['required', 'boolean']];
    }
}
