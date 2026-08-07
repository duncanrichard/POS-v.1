<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SoftDeleteAudit
{
    public static function record(Request $request, string $table, object|array $row, ?string $reason = null): void
    {
        $data = (array) $row;
        DB::table('soft_delete_records')->insert([
            'source_table' => $table,
            'source_id' => (string) ($data['id'] ?? ''),
            'data_snapshot' => json_encode($data),
            'deleted_by' => $request->user()?->id,
            'reason' => $reason ?: $request->input('reason'),
            'deleted_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
