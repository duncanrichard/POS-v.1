<?php

namespace App\Http\Controllers\MasterData;

use App\Models\AddOn;
use Illuminate\Http\Request;

class AddOnController extends MasterDataResourceController
{
    protected string $modelClass = AddOn::class;

    protected ?string $scopeColumn = 'company_id';

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'ADD';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:120'], 'price' => ['required', 'numeric', 'min:0', 'max:9999999999999.99'], 'is_active' => ['required', 'boolean']];
    }
}
