<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $companyId = (string) Str::uuid();
        $outletId = (string) Str::uuid();

        $existingCompanyId = DB::table('companies')->where('code', 'POSPHERE')->value('id');
        if ($existingCompanyId) {
            $companyId = $existingCompanyId;
            DB::table('companies')->where('id', $companyId)->update([
                'name' => 'POSphere Indonesia', 'is_active' => true, 'updated_at' => now(),
            ]);
        } else {
            DB::table('companies')->insert([
                'id' => $companyId, 'code' => 'POSPHERE', 'name' => 'POSphere Indonesia',
                'timezone' => 'Asia/Jakarta', 'currency_code' => 'IDR', 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $existingOutletId = DB::table('outlets')->where('company_id', $companyId)
            ->whereIn('code', ['JKS', 'STR-0001'])->orderBy('store_number')->value('id');
        if ($existingOutletId) {
            $outletId = $existingOutletId;
            DB::table('outlets')->where('id', $outletId)->update([
                'store_number' => DB::table('outlets')->where('id', $outletId)->value('store_number') ?: 1,
                'code' => 'STR-0001',
                'name' => 'Jakarta Selatan',
                'address' => 'Jakarta Selatan, DKI Jakarta',
                'latitude' => -6.261493,
                'longitude' => 106.810600,
                'timezone' => 'Asia/Jakarta',
                'status' => 'active',
                'updated_at' => now(),
            ]);
        } else {
            DB::table('outlets')->insert([
                'id' => $outletId, 'company_id' => $companyId, 'store_number' => 1, 'code' => 'STR-0001',
                'name' => 'Jakarta Selatan', 'address' => 'Jakarta Selatan, DKI Jakarta',
                'latitude' => -6.261493, 'longitude' => 106.810600,
                'timezone' => 'Asia/Jakarta', 'status' => 'active',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        DB::table('outlet_settings')->updateOrInsert(['outlet_id' => $outletId], [
            'tax_inclusive' => false,
            'require_qr_order_approval' => false,
            'allow_negative_stock' => false,
            'stock_deduction_stage' => 'sent_to_kitchen',
            'prepaid_only' => false,
            'default_service_charge' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $permissionGroups = [
            'holding' => ['holding.view', 'holding.manage', 'stores.create', 'stores.update', 'users.create', 'users.update', 'roles.manage'],
            'sales' => ['sales.view', 'sales.create', 'sales.void', 'payments.manage'],
            'kitchen' => ['kitchen.view', 'kitchen.update'],
            'inventory' => ['inventory.view', 'inventory.manage', 'inventory.approve'],
            'purchasing' => ['purchasing.view', 'purchasing.manage', 'purchasing.approve'],
            'customer' => ['customers.view', 'customers.manage', 'promotions.manage'],
            'reporting' => ['reports.view', 'reports.export'],
            'settings' => ['settings.view', 'settings.manage'],
        ];
        foreach (collect($permissionGroups)->flatten() as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $roles = [
            'holding-admin' => collect($permissionGroups)->flatten()->all(),
            'store-manager' => collect($permissionGroups)->except('holding')->flatten()->all(),
            'cashier' => ['sales.view', 'sales.create', 'payments.manage', 'customers.view'],
            'kitchen' => ['kitchen.view', 'kitchen.update'],
            'inventory-staff' => ['inventory.view', 'inventory.manage', 'purchasing.view'],
        ];
        foreach ($roles as $roleName => $permissions) {
            Role::findOrCreate($roleName, 'web')->syncPermissions($permissions);
        }

        $holdingPositionId = DB::table('positions')->where('company_id', $companyId)->where('code', 'HOLDING-ADMIN')->value('id') ?: (string) Str::uuid();
        DB::table('positions')->updateOrInsert(['company_id' => $companyId, 'code' => 'HOLDING-ADMIN'], [
            'id' => $holdingPositionId, 'name' => 'Holding Administrator', 'description' => 'Pengelola seluruh store dan akses Holding.',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $managerPositionId = DB::table('positions')->where('company_id', $companyId)->where('code', 'STORE-MANAGER')->value('id') ?: (string) Str::uuid();
        DB::table('positions')->updateOrInsert(['company_id' => $companyId, 'code' => 'STORE-MANAGER'], [
            'id' => $managerPositionId, 'name' => 'Store Manager', 'description' => 'Penanggung jawab operasional store.',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $holdingAdmin = User::query()->updateOrCreate(
            ['email' => 'admin@posphere.id'],
            [
                'name' => 'Holding Administrator',
                'company_id' => $companyId,
                'outlet_id' => null,
                'phone' => '081234567890',
                'position' => 'Holding Administrator',
                'position_id' => $holdingPositionId,
                'status' => 'active',
                'password' => Hash::make('Posphere123!'),
                'email_verified_at' => now(),
            ]
        );
        $holdingAdmin->syncRoles(['holding-admin']);

        $storeManager = User::query()->updateOrCreate(
            ['email' => 'manager.jks@posphere.id'],
            [
                'name' => 'Manager Jakarta Selatan',
                'company_id' => $companyId,
                'outlet_id' => $outletId,
                'phone' => '081298765432',
                'position' => 'Store Manager',
                'position_id' => $managerPositionId,
                'status' => 'active',
                'password' => Hash::make('Store123!'),
                'email_verified_at' => now(),
            ]
        );
        $storeManager->syncRoles(['store-manager']);

        $this->call(CheeseBurgerRecipeSeeder::class);
        $this->call(IngredientModifierSeeder::class);
    }
}
