<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends MasterDataResourceController
{
    protected string $modelClass = Category::class;

    protected ?string $scopeColumn = 'outlet_id';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:120'], 'is_active' => ['required', 'boolean']];
    }

    protected function prepareData(array $data, Request $request): array
    {
        return [...parent::prepareData($data, $request), 'company_id' => $request->user()->company_id, 'type' => 'menu'];
    }
}
