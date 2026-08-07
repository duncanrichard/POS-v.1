<?php

namespace App\Http\Controllers;

use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\SoftDeleteAudit;

class MasterDataController extends Controller
{
    private const RESOURCES = [
        'categories' => ['table' => 'categories', 'scope' => 'outlet_id'],
        'positions' => ['table' => 'positions', 'scope' => 'company_id'],
        'products' => ['table' => 'products', 'scope' => 'company_id'],
        'add-ons' => ['table' => 'add_ons', 'scope' => 'company_id'],
        'ingredient-modifiers' => ['table' => 'ingredient_modifiers', 'scope' => 'company_id'],
        'material-categories' => ['table' => 'material_categories', 'scope' => 'company_id'],
        'materials' => ['table' => 'materials', 'scope' => 'company_id'],
        'units' => ['table' => 'units', 'scope' => null],
        'suppliers' => ['table' => 'suppliers', 'scope' => 'outlet_id'],
        'warehouses' => ['table' => 'warehouses', 'scope' => 'outlet_id'],
        'stations' => ['table' => 'kitchen_stations', 'scope' => 'outlet_id'],
        'tables' => ['table' => 'dining_tables', 'scope' => 'outlet_id'],
    ];

    public function index(Request $request, string $resource): JsonResponse
    {
        $config = $this->resource($resource);
        if ($resource === 'tables') {
            $query = DB::table('dining_tables');
            $query->whereNull('deleted_at');
            $this->applyScope($query, $request, $config);
            $tables = $query->orderBy('table_number')->get();
            $qrCodes = DB::table('table_qr_codes')->whereIn('dining_table_id', $tables->pluck('id'))
                ->where('is_active', true)->get()->keyBy('dining_table_id');

            return response()->json($tables->map(function ($table) use ($qrCodes) {
                $qr = $qrCodes->get($table->id);
                $token = $qr ? Crypt::decryptString($qr->token_encrypted) : null;
                return [
                    ...((array) $table),
                    'qr_data' => $token ? url('/public/tables/'.$token) : null,
                ];
            }));
        }
        $query = DB::table($config['table']);
        $query->whereNull('deleted_at');
        $this->applyScope($query, $request, $config);

        $rows = $query->orderBy('name')->get();
        if ($resource === 'products') {
            $variants = DB::table('product_variants')->whereIn('product_id', $rows->pluck('id'))
                ->orderByRaw("CASE name WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 ELSE 4 END")
                ->get()->groupBy('product_id');
            $rows = $rows->map(fn ($row) => [
                ...((array) $row),
                'variants' => $variants->get($row->id, collect())->values(),
            ]);
        }

        return response()->json($rows);
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $config = $this->resource($resource);
        $data = $this->validated($request, $resource);
        $this->storeProductImage($request, $resource, $data);
        if ($resource === 'tables') {
            return $this->storeTable($request, $data);
        }
        $data['id'] = (string) Str::uuid();
        $data['created_at'] = now();
        $data['updated_at'] = now();
        $this->injectScope($data, $request, $config);

        if ($resource === 'products') {
            DB::transaction(function () use (&$data, $request, $config) {
                DB::table('companies')->where('id', $request->user()->company_id)->lockForUpdate()->first();
                $variants = $data['variants'];
                unset($data['variants']);
                $data['sku'] = $this->generateProductSku($request->user()->company_id, $data['category_id'] ?? null);
                DB::table($config['table'])->insert($data);
                $this->syncProductVariants($data['id'], $data['sku'], $variants);
            });
        } elseif (isset($this->generatedCodeMap()[$resource])) {
            DB::transaction(function () use (&$data, $request, $config, $resource) {
                DB::table('companies')->where('id', $request->user()->company_id)->lockForUpdate()->first();
                [$column, $prefix] = $this->generatedCodeMap()[$resource];
                $data[$column] = $this->generateSequentialCode($config['table'], $column, $prefix);
                DB::table($config['table'])->insert($data);
            });
        } else {
            DB::table($config['table'])->insert($data);
        }

        return response()->json([
            'message' => $resource === 'products' ? 'Produk berhasil dibuat dengan SKU '.$data['sku'].'.' : 'Data berhasil ditambahkan.',
            'id' => $data['id'],
            ...($resource === 'products' ? ['sku' => $data['sku']] : []),
        ], 201);
    }

    public function update(Request $request, string $resource, string $id): JsonResponse
    {
        $config = $this->resource($resource);
        $query = DB::table($config['table'])->where('id', $id)->whereNull('deleted_at');
        $this->applyScope($query, $request, $config);
        abort_unless($query->exists(), 404);

        $data = $this->validated($request, $resource, $id);
        $this->storeProductImage($request, $resource, $data, $query->first());
        if ($resource === 'tables') {
            $data['code'] = 'TBL-'.str_pad((string) $data['table_number'], 4, '0', STR_PAD_LEFT);
        }
        $data['updated_at'] = now();
        if ($resource === 'products') {
            DB::transaction(function () use ($query, &$data, $id) {
                $variants = $data['variants'];
                unset($data['variants']);
                $sku = $query->value('sku');
                $query->update($data);
                $this->syncProductVariants($id, $sku, $variants);
            });
        } else {
            $query->update($data);
        }

        return response()->json(['message' => 'Data berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $resource, string $id): JsonResponse
    {
        $config = $this->resource($resource);
        $query = DB::table($config['table'])->where('id', $id)->whereNull('deleted_at');
        $this->applyScope($query, $request, $config);
        abort_unless($query->exists(), 404);

        $row = $query->first();
        DB::transaction(function () use ($request, $query, $config, $row) {
            SoftDeleteAudit::record($request, $config['table'], $row);
            $query->update(['deleted_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['message' => 'Data berhasil dihapus.']);
    }

    private function resource(string $resource): array
    {
        abort_unless(isset(self::RESOURCES[$resource]), 404);
        return self::RESOURCES[$resource];
    }

    private function validated(Request $request, string $resource, ?string $id = null): array
    {
        return match ($resource) {
            'categories' => [
                ...$request->validate([
                    'name' => ['required', 'string', 'max:120'],
                    'is_active' => ['required', 'boolean'],
                ]),
                'type' => 'menu',
            ],
            'positions' => $request->validate([
                'name' => ['required', 'string', 'max:100'],
                'description' => ['nullable', 'string', 'max:1000'],
                'is_active' => ['required', 'boolean'],
            ]),
            'products' => [
                ...$request->validate([
                    'name' => ['required', 'string', 'max:180'],
                    'category_id' => ['required', Rule::exists('categories', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')],
                    'base_unit_id' => ['required', 'exists:units,id'],
                    'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
                    'variants' => ['required', 'array', 'size:3'],
                    'variants.*.name' => ['required', Rule::in(['S', 'M', 'L']), 'distinct'],
                    'variants.*.is_active' => ['required', 'boolean'],
                    'is_active' => ['required', 'boolean'],
                ]),
                'product_type' => 'menu',
            ],
            'add-ons' => $request->validate([
                'name' => ['required', 'string', 'max:120'],
                'price' => ['required', 'numeric', 'min:0', 'max:9999999999999.99'],
                'is_active' => ['required', 'boolean'],
            ]),
            'ingredient-modifiers' => $request->validate(
                [
                    'material_id' => [
                        'required',
                        Rule::exists('materials', 'id')
                            ->where('company_id', $request->user()->company_id)
                            ->whereNull('deleted_at'),
                        Rule::unique('ingredient_modifiers', 'material_id')
                            ->where('company_id', $request->user()->company_id)
                            ->whereNull('deleted_at')
                            ->ignore($id, 'id'),
                    ],
                    'name' => ['required', 'string', 'max:120'],
                    'is_active' => ['required', 'boolean'],
                ],
                [
                    'material_id.unique' => 'Ingredient ini sudah memiliki modifier. Gunakan tombol Edit pada data yang sudah tersedia.',
                    'material_id.exists' => 'Ingredient tidak valid atau sudah tidak aktif.',
                ],
            ),
            'material-categories' => $request->validate([
                'name' => ['required', 'string', 'max:120'],
                'material_group' => ['required', Rule::in(['raw', 'packaging', 'supporting'])],
                'is_active' => ['required', 'boolean'],
            ]),
            'materials' => $request->validate([
                'name' => ['required', 'string', 'max:180'],
                'material_category_id' => ['required', 'exists:material_categories,id'],
                'base_unit_id' => ['required', 'exists:units,id'],
                'buffer_stock' => ['required', 'numeric', 'min:0'],
                'stock_barrier' => ['required', 'numeric', 'min:0', 'gte:buffer_stock'],
                'is_active' => ['required', 'boolean'],
            ]),
            'units' => $request->validate([
                'name' => ['required', 'string', 'max:60'],
                'unit_type' => ['required', Rule::in(['weight', 'volume', 'quantity'])],
            ]),
            'suppliers' => $request->validate([
                'name' => ['required', 'string', 'max:150'],
                'phone' => ['nullable', 'string', 'max:30'],
                'email' => ['nullable', 'email', 'max:255'],
                'is_active' => ['required', 'boolean'],
            ]),
            'warehouses' => $request->validate([
                'name' => ['required', 'string', 'max:120'],
                'is_active' => ['required', 'boolean'],
            ]),
            'stations' => $request->validate([
                'name' => ['required', 'string', 'max:100'],
                'sla_minutes' => ['required', 'integer', 'min:1', 'max:240'],
                'is_active' => ['required', 'boolean'],
            ]),
            'tables' => $request->validate([
                'table_number' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:9999',
                    Rule::unique('dining_tables', 'table_number')
                        ->where('outlet_id', $this->resolvedOutletId($request))
                        ->ignore($id, 'id'),
                ],
                'name' => ['required', 'string', 'max:80'],
                'capacity' => ['required', 'integer', 'min:1', 'max:100'],
                'status' => ['required', Rule::in(['available', 'occupied', 'inactive'])],
            ]),
        };
    }

    private function storeTable(Request $request, array $data): JsonResponse
    {
        $outletId = $this->resolvedOutletId($request);
        abort_unless($outletId, 422, 'Pilih store terlebih dahulu.');
        abort_unless(DB::table('outlets')->where('id', $outletId)->where('company_id', $request->user()->company_id)->exists(), 403);

        $id = (string) Str::uuid();
        $token = Str::random(64);
        $tableNumber = DB::transaction(function () use ($outletId, $id, $token, $data) {
            DB::table('outlets')->where('id', $outletId)->lockForUpdate()->first();
            $number = (int) $data['table_number'];
            DB::table('dining_tables')->insert([
                'id' => $id, 'outlet_id' => $outletId, 'table_number' => $number,
                'code' => 'TBL-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'name' => $data['name'], 'capacity' => $data['capacity'], 'status' => $data['status'],
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('table_qr_codes')->insert([
                'id' => (string) Str::uuid(), 'dining_table_id' => $id,
                'token_hash' => hash('sha256', $token), 'token_encrypted' => Crypt::encryptString($token),
                'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
            return $number;
        });

        return response()->json([
            'message' => 'Meja dan QR berhasil dibuat.',
            'id' => $id,
            'code' => 'TBL-'.str_pad((string) $tableNumber, 4, '0', STR_PAD_LEFT),
            'qr_data' => url('/public/tables/'.$token),
        ], 201);
    }

    private function storeProductImage(Request $request, string $resource, array &$data, ?object $current = null): void
    {
        if ($resource !== 'products') {
            return;
        }
        unset($data['image']);
        if (!$request->hasFile('image')) {
            return;
        }
        $path = $request->file('image')->store('products', 'public');
        if ($current?->image_path) {
            Storage::disk('public')->delete($current->image_path);
        }
        $data['image_path'] = $path;
    }

    private function applyScope($query, Request $request, array $config): void
    {
        if ($config['scope'] === 'company_id') {
            $query->where('company_id', $request->user()->company_id);
        }
        if ($config['scope'] === 'outlet_id') {
            // POST/PUT mengirim outlet_id melalui body, sedangkan GET/DELETE
            // dapat mengirimkannya melalui query string.
            $outletId = $request->input('outlet_id', $request->user()->outlet_id);
            if ($outletId) {
                abort_unless(DB::table('outlets')->where('id', $outletId)->where('company_id', $request->user()->company_id)->exists(), 403);
                $query->where('outlet_id', $outletId);
            } elseif ($request->isMethod('get')) {
                $query->whereIn('outlet_id', DB::table('outlets')->where('company_id', $request->user()->company_id)->select('id'));
            } else {
                abort(422, 'Pilih store terlebih dahulu.');
            }
        }
    }

    private function injectScope(array &$data, Request $request, array $config): void
    {
        if (in_array($config['table'], ['categories', 'products', 'material_categories', 'materials', 'item_categories', 'suppliers'], true)) {
            $data['company_id'] = $request->user()->company_id;
        }
        if ($config['scope'] === 'company_id') {
            $data['company_id'] = $request->user()->company_id;
        }
        if ($config['scope'] === 'outlet_id') {
            $outletId = $this->resolvedOutletId($request);
            abort_unless($outletId, 422, 'Pilih store terlebih dahulu.');
            abort_unless(DB::table('outlets')->where('id', $outletId)->where('company_id', $request->user()->company_id)->exists(), 403);
            $data['outlet_id'] = $outletId;
        }
    }

    private function validateProductPrices(Request $request, array $data): void
    {
        $outletId = $this->resolvedOutletId($request);
        $ingredients = collect($request->input('ingredients', []))
            ->filter(fn ($item) => !empty($item['material_id']) && is_numeric($item['quantity'] ?? null));
        $materialIds = $ingredients->pluck('material_id')->unique()->values();
        $materials = DB::table('materials')->where('outlet_id', $outletId)
            ->whereIn('id', $materialIds)->get(['id', 'average_cost'])->keyBy('id');

        if ($materialIds->count() !== $materials->count()) {
            throw ValidationException::withMessages([
                'ingredients' => 'Terdapat ingredient yang tidak valid untuk Store ini.',
            ]);
        }

        $ingredientTotal = $ingredients->sum(fn ($item) =>
            (float) $item['quantity'] * (float) $materials->get($item['material_id'])->average_cost
        );

        if ((float) $data['average_cost'] < $ingredientTotal) {
            throw ValidationException::withMessages([
                'average_cost' => 'Harga modal tidak boleh kurang dari total ingredient Rp '.number_format($ingredientTotal, 2, ',', '.').'.',
            ]);
        }
        if ((float) $data['selling_price'] < (float) $data['average_cost']) {
            throw ValidationException::withMessages([
                'selling_price' => 'Harga jual tidak boleh kurang dari harga modal.',
            ]);
        }
    }

    private function resolvedOutletId(Request $request): ?string
    {
        return $request->input('outlet_id')
            ?: $request->user()->outlet_id
            ?: DB::table('outlets')->where('company_id', $request->user()->company_id)
                ->where('status', 'active')->orderBy('store_number')->value('id');
    }

    private function generateProductSku(string $companyId, ?string $categoryId): string
    {
        $category = $categoryId ? DB::table('categories')->where('id', $categoryId)->value('name') : null;
        $categoryCode = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $category ?: 'GEN'), 0, 3));
        $categoryCode = str_pad($categoryCode, 3, 'X');
        $prefix = 'MENU-'.$categoryCode.'-';
        $lastNumber = DB::table('products')->where('company_id', $companyId)
            ->where('sku', 'like', $prefix.'%')->pluck('sku')
            ->map(fn ($sku) => (int) substr($sku, strlen($prefix)))->max() ?? 0;

        return $prefix.str_pad((string) ($lastNumber + 1), 4, '0', STR_PAD_LEFT);
    }

    private function syncProductVariants(string $productId, string $productSku, array $variants): void
    {
        foreach ($variants as $variant) {
            DB::table('product_variants')->updateOrInsert(
                ['product_id' => $productId, 'name' => $variant['name']],
                [
                    'id' => DB::table('product_variants')->where('product_id', $productId)
                        ->where('name', $variant['name'])->value('id') ?: (string) Str::uuid(),
                    'sku' => $productSku.'-'.$variant['name'],
                    'price_delta' => 0,
                    'is_active' => $variant['is_active'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    private function generatedCodeMap(): array
    {
        return [
            'positions' => ['code', 'POS'],
            'materials' => ['sku', 'ING'],
            'units' => ['code', 'UNT'],
            'suppliers' => ['code', 'SUP'],
            'warehouses' => ['code', 'WH'],
            'stations' => ['code', 'KST'],
            'add-ons' => ['code', 'ADD'],
        ];
    }

    private function generateSequentialCode(string $table, string $column, string $prefix): string
    {
        $codePrefix = $prefix.'-';
        $lastNumber = DB::table($table)->where($column, 'like', $codePrefix.'%')->pluck($column)
            ->map(fn ($code) => (int) substr($code, strlen($codePrefix)))->max() ?? 0;

        return $codePrefix.str_pad((string) ($lastNumber + 1), 4, '0', STR_PAD_LEFT);
    }
}
