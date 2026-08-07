<?php

namespace App\Http\Controllers\MasterData;

use App\Models\KitchenStation;
use Illuminate\Http\Request;

class KitchenStationController extends MasterDataResourceController
{
    protected string $modelClass = KitchenStation::class;

    protected ?string $scopeColumn = 'outlet_id';

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'KST';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:100'], 'sla_minutes' => ['required', 'integer', 'min:1', 'max:240'], 'is_active' => ['required', 'boolean']];
    }
}
