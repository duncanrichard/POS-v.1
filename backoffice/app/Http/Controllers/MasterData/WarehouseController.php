<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Warehouse;
use Illuminate\Http\Request;

class WarehouseController extends MasterDataResourceController
{
    protected string $modelClass = Warehouse::class;

    protected ?string $scopeColumn = 'outlet_id';

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'WH';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:120'], 'is_active' => ['required', 'boolean']];
    }
}
