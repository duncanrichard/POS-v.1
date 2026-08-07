<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends MasterDataResourceController
{
    protected string $modelClass = Supplier::class;

    protected ?string $scopeColumn = 'outlet_id';

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'SUP';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:150'], 'phone' => ['nullable', 'string', 'max:30'], 'email' => ['nullable', 'email', 'max:255'], 'is_active' => ['required', 'boolean']];
    }

    protected function prepareData(array $data, Request $request): array
    {
        return [...parent::prepareData($data, $request), 'company_id' => $request->user()->company_id];
    }
}
