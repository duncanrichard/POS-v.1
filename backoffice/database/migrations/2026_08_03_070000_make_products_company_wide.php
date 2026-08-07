<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE products ALTER COLUMN outlet_id DROP NOT NULL');
        DB::table('products')->update(['outlet_id' => null, 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            UPDATE products p
            SET outlet_id = (
                SELECT o.id
                FROM outlets o
                WHERE o.company_id = p.company_id
                  AND o.deleted_at IS NULL
                ORDER BY o.store_number
                LIMIT 1
            )
        SQL);
        DB::statement('ALTER TABLE products ALTER COLUMN outlet_id SET NOT NULL');
    }
};
