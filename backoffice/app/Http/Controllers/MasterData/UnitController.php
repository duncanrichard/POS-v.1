<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UnitController extends MasterDataResourceController
{
    protected string $modelClass = Unit::class;

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'UNT';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:60'], 'unit_type' => ['required', Rule::in(['weight', 'volume', 'quantity'])]];
    }
}
