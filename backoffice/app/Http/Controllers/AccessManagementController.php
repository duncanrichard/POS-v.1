<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AccessManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        return response()->json([
            'roles' => Role::with('permissions:id,name')->orderBy('name')->get()->map(fn ($role) => [
                'id' => $role->uuid, 'name' => $role->name, 'permissions' => $role->permissions->pluck('name'),
            ]),
            'permissions' => Permission::orderBy('name')->get(['uuid as id', 'name']),
            'accounts' => User::query()->where('users.company_id', $companyId)
                ->leftJoin('outlets', 'outlets.id', '=', 'users.outlet_id')
                ->leftJoin('positions', 'positions.id', '=', 'users.position_id')
                ->with('roles:id,name')->orderBy('users.name')
                ->get(['users.uuid as id', 'users.name', 'users.email', 'users.phone', 'users.status', 'users.account_channel', 'users.outlet_id', 'users.position_id', 'outlets.name as outlet_name', 'positions.name as position_name'])
                ->map(fn ($user) => [...$user->toArray(), 'role' => $user->roles->first()?->name ?? '-']),
            'stores' => DB::table('outlets')->where('company_id', $companyId)->where('status', 'active')->orderBy('name')->get(['id', 'name']),
            'positions' => DB::table('positions')->where('company_id', $companyId)->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:roles,name'],
            'permissions' => ['array'],
            'permissions.*' => ['exists:permissions,name'],
        ]);
        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->forceFill(['uuid' => (string) \Illuminate\Support\Str::uuid()])->save();
        $role->syncPermissions($data['permissions'] ?? []);
        return response()->json(['message' => 'Role berhasil dibuat.'], 201);
    }

    public function updateRole(Request $request, string $role): JsonResponse
    {
        $role = Role::where('uuid', $role)->firstOrFail();
        abort_if($role->name === 'holding-admin', 422, 'Role Holding Admin tidak dapat diubah.');
        $data = $request->validate(['permissions' => ['array'], 'permissions.*' => ['exists:permissions,name']]);
        $role->syncPermissions($data['permissions'] ?? []);
        return response()->json(['message' => 'Permission role berhasil diperbarui.']);
    }

    public function storePermission(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:100', 'unique:permissions,name']]);
        $permission = Permission::create(['name' => $data['name'], 'guard_name' => 'web']);
        $permission->forceFill(['uuid' => (string) \Illuminate\Support\Str::uuid()])->save();
        return response()->json(['message' => 'Permission berhasil dibuat.'], 201);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'outlet_id' => ['required', Rule::exists('outlets', 'id')->where('company_id', $companyId)],
            'position_id' => ['required', Rule::exists('positions', 'id')->where('company_id', $companyId)],
            'role' => ['required', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'password' => ['required', 'string', 'min:8'],
            'account_channel' => ['required', Rule::in(['backoffice', 'pos', 'both'])],
        ]);
        abort_if($data['role'] === 'holding-admin', 422, 'Role Holding Admin tidak dapat diberikan ke akun store.');
        $positionName = DB::table('positions')->where('id', $data['position_id'])->value('name');
        $user = User::create([
            ...$data, 'uuid' => (string) \Illuminate\Support\Str::uuid(), 'company_id' => $companyId, 'position' => $positionName,
            'password' => Hash::make($data['password']), 'status' => 'active', 'email_verified_at' => now(),
        ]);
        $user->assignRole($data['role']);
        return response()->json(['message' => 'Akun store berhasil dibuat.'], 201);
    }
}
