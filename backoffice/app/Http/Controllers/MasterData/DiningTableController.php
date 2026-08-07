<?php

namespace App\Http\Controllers\MasterData;

use App\Models\DiningTable;
use App\Models\TableQrCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DiningTableController extends MasterDataResourceController
{
    protected string $modelClass = DiningTable::class;

    protected ?string $scopeColumn = 'outlet_id';

    protected function rules(Request $request, ?string $id = null): array
    {
        return [
            'table_number' => ['required', 'integer', 'min:1', 'max:9999', Rule::unique('dining_tables')->where('outlet_id', $this->outletId($request))->ignore($id)],
            'name' => ['required', 'string', 'max:80'],
            'capacity' => ['required', 'integer', 'min:1', 'max:100'],
            'status' => ['required', Rule::in(['available', 'occupied', 'inactive'])],
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $rows = $this->scopedQuery($request)->with('activeQrCode')->orderBy('table_number')->get()
            ->map(function (DiningTable $table) {
                $token = $table->activeQrCode ? Crypt::decryptString($table->activeQrCode->token_encrypted) : null;

                return [...$table->makeHidden('activeQrCode')->toArray(), 'qr_data' => $token ? $this->customerAppUrl($token) : null];
            });

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->prepareData($request->validate($this->rules($request)), $request);
        [$table, $token] = DB::transaction(function () use ($data) {
            $token = Str::random(64);
            $table = DiningTable::create([...$data, 'code' => 'TBL-'.str_pad((string) $data['table_number'], 4, '0', STR_PAD_LEFT)]);
            TableQrCode::create(['dining_table_id' => $table->id, 'token_hash' => hash('sha256', $token), 'token_encrypted' => Crypt::encryptString($token), 'is_active' => true]);

            return [$table, $token];
        });

        return response()->json(['message' => 'Meja dan QR berhasil dibuat.', 'id' => $table->id, 'code' => $table->code, 'qr_data' => $this->customerAppUrl($token)], 201);
    }

    protected function prepareData(array $data, Request $request): array
    {
        $data = parent::prepareData($data, $request);
        $data['code'] = 'TBL-'.str_pad((string) $data['table_number'], 4, '0', STR_PAD_LEFT);

        return $data;
    }

    private function customerAppUrl(string $token): string
    {
        return rtrim((string) config('services.customer_app_url'), '/').'/table/'.$token;
    }
}
