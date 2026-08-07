<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Material;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaterialController extends MasterDataResourceController
{
    protected string $modelClass = Material::class;

    protected ?string $scopeColumn = 'company_id';

    protected ?string $codeColumn = 'sku';

    protected ?string $codePrefix = 'ING';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:180'], 'material_category_id' => ['required', Rule::exists('material_categories', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')], 'base_unit_id' => ['required', 'exists:units,id'], 'buffer_stock' => ['required', 'numeric', 'min:0'], 'stock_barrier' => ['required', 'numeric', 'min:0', 'gte:buffer_stock'], 'is_active' => ['required', 'boolean']];
    }
}
