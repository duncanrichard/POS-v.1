<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class PosAccountSeeder extends Seeder
{
    public function run(): void
    {
        $outlet = DB::table('outlets')->where('code', 'STR-0001')->first();
        if (! $outlet) return;
        $position = DB::table('positions')->where('company_id', $outlet->company_id)
            ->whereRaw('lower(name) like ?', ['%kasir%'])->first();
        $role = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        if (! $role->uuid) $role->forceFill(['uuid' => (string) Str::uuid()])->save();
        $user = User::updateOrCreate(['email' => 'cashier@posphere.id'], [
            'uuid' => (string) Str::uuid(), 'company_id' => $outlet->company_id,
            'outlet_id' => $outlet->id, 'position_id' => $position?->id,
            'position' => $position?->name ?: 'Kasir', 'name' => 'Kasir Jakarta Selatan',
            'status' => 'active', 'account_channel' => 'pos',
            'password' => Hash::make('Posphere123!'), 'email_verified_at' => now(),
        ]);
        $user->syncRoles([$role]);
    }
}
