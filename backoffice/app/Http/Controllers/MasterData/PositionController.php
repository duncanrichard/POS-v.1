<?php

namespace App\Http\Controllers\MasterData;

use App\Models\Position;
use Illuminate\Http\Request;

class PositionController extends MasterDataResourceController
{
    protected string $modelClass = Position::class;

    protected ?string $scopeColumn = 'company_id';

    protected ?string $codeColumn = 'code';

    protected ?string $codePrefix = 'POS';

    protected function rules(Request $request, ?string $id = null): array
    {
        return ['name' => ['required', 'string', 'max:100'], 'description' => ['nullable', 'string', 'max:1000'], 'is_active' => ['required', 'boolean']];
    }
}
