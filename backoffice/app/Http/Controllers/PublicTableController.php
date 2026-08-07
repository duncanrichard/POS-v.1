<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PublicTableController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $table = DB::table('table_qr_codes as qr')
            ->join('dining_tables as dt', 'dt.id', '=', 'qr.dining_table_id')
            ->join('outlets as o', 'o.id', '=', 'dt.outlet_id')
            ->where('qr.token_hash', hash('sha256', $token))
            ->where('qr.is_active', true)
            ->where('dt.status', '!=', 'inactive')
            ->select('dt.id', 'dt.code', 'dt.name', 'dt.capacity', 'o.id as outlet_id', 'o.name as outlet_name')
            ->first();

        abort_unless($table, 404);

        return response()->json($table);
    }
}
