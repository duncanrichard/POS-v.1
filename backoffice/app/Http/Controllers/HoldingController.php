<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Database\QueryException;
use Spatie\Permission\Models\Role;
use App\Support\SoftDeleteAudit;

class HoldingController extends Controller
{
    public function stores(Request $request): JsonResponse
    {
        return response()->json([
            'stores' => DB::table('outlets')
                ->where('company_id', $request->user()->company_id)
                ->orderBy('name')
                ->get(['id', 'store_number', 'code', 'name', 'address', 'latitude', 'longitude', 'status']),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        return response()->json([
            'stores' => DB::table('outlets')
                ->where('company_id', $companyId)
                ->whereNull('deleted_at')
                ->orderBy('name')
                ->get(['id', 'store_number', 'code', 'name', 'address', 'latitude', 'longitude', 'status']),
            'users' => User::query()
                ->where('users.company_id', $companyId)
                ->with(['roles:id,name'])
                ->leftJoin('outlets', 'users.outlet_id', '=', 'outlets.id')
                ->orderBy('users.name')
                ->get(['users.id', 'users.name', 'users.email', 'users.phone', 'users.position', 'users.status', 'users.outlet_id', 'outlets.name as outlet_name'])
                ->map(fn ($user) => [
                    ...$user->toArray(),
                    'role' => $user->roles->first()?->name ?? '-',
                ]),
            'roles' => Role::query()->where('name', '!=', 'holding-admin')->orderBy('name')->pluck('name'),
        ]);
    }

    public function storeOutlet(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $id = (string) Str::uuid();
        $storeNumber = DB::transaction(function () use ($id, $companyId, $data) {
            DB::table('companies')->where('id', $companyId)->lockForUpdate()->first();
            $storeNumber = ((int) DB::table('outlets')->where('company_id', $companyId)->max('store_number')) + 1;
            $code = 'STR-'.str_pad((string) $storeNumber, 4, '0', STR_PAD_LEFT);
            DB::table('outlets')->insert([
                'id' => $id, 'company_id' => $companyId, 'store_number' => $storeNumber, 'code' => $code,
                'name' => $data['name'], 'address' => $data['address'] ?? null,
                'latitude' => $data['latitude'], 'longitude' => $data['longitude'],
                'timezone' => 'Asia/Jakarta', 'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('outlet_settings')->insert([
                'outlet_id' => $id, 'tax_inclusive' => false, 'require_qr_order_approval' => false,
                'allow_negative_stock' => false, 'stock_deduction_stage' => 'sent_to_kitchen',
                'prepaid_only' => false, 'default_service_charge' => 0, 'created_at' => now(), 'updated_at' => now(),
            ]);
            return $storeNumber;
        });

        return response()->json([
            'message' => 'Store berhasil dibuat.',
            'id' => $id,
            'store_number' => $storeNumber,
            'code' => 'STR-'.str_pad((string) $storeNumber, 4, '0', STR_PAD_LEFT),
        ], 201);
    }

    public function updateOutlet(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;
        abort_unless(DB::table('outlets')->where('id', $id)->where('company_id', $companyId)->exists(), 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);

        DB::table('outlets')->where('id', $id)->where('company_id', $companyId)
            ->update([...$data, 'updated_at' => now()]);

        return response()->json(['message' => 'Store berhasil diperbarui.']);
    }

    public function destroyOutlet(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $query = DB::table('outlets')->where('id', $id)->where('company_id', $companyId)->whereNull('deleted_at');
        abort_unless($query->exists(), 404);

        if (DB::table('users')->where('outlet_id', $id)->exists()) {
            return response()->json(['message' => 'Store masih memiliki akun pengguna dan tidak dapat dihapus.'], 422);
        }

        try {
            DB::transaction(function () use ($request, $query) {
                $row = $query->first();
                SoftDeleteAudit::record($request, 'outlets', $row);
                $query->update(['deleted_at' => now(), 'updated_at' => now()]);
            });
        } catch (QueryException) {
            return response()->json(['message' => 'Store sudah memiliki transaksi dan tidak dapat dihapus. Nonaktifkan store sebagai gantinya.'], 422);
        }

        return response()->json(['message' => 'Store berhasil dihapus.']);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'outlet_id' => ['required', Rule::exists('outlets', 'id')->where('company_id', $companyId)],
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'position' => ['required', 'string', 'max:80'],
            'role' => ['required', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'password' => ['required', 'string', 'min:8'],
        ]);

        abort_if($data['role'] === 'holding-admin', 422, 'Role Holding tidak dapat diberikan ke akun store.');

        $user = User::query()->create([
            ...$data,
            'company_id' => $companyId,
            'password' => Hash::make($data['password']),
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
        $user->assignRole($data['role']);

        return response()->json(['message' => 'Akun store berhasil dibuat.', 'id' => $user->id], 201);
    }
}
