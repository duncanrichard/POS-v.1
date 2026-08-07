<?php

namespace App\Http\Controllers\MasterData;

use App\Models\MaterialCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaterialCategoryController extends MasterDataResourceController
{
    protected string $modelClass = MaterialCategory::class;

    protected ?string $scopeColumn = 'company_id';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:120'], 'material_group' => ['required', Rule::in(['raw', 'packaging', 'supporting'])], 'is_active' => ['required', 'boolean']];
    }
}
