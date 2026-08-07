<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', $data['email'])->where('status', 'active')
            ->whereIn('account_channel', ['pos', 'both'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password) || ! $user->outlet_id) {
            throw ValidationException::withMessages(['email' => 'Akun POS tidak valid, tidak aktif, atau belum memiliki cabang.']);
        }
        $outlet = DB::table('outlets')->where('id', $user->outlet_id)->where('company_id', $user->company_id)
            ->where('status', 'active')->whereNull('deleted_at')->first(['id', 'code', 'name']);
        abort_unless($outlet, 422, 'Cabang akun sedang tidak aktif.');
        DB::table('pos_access_tokens')->where('user_id', $user->id)
            ->where(fn ($query) => $query->where('expires_at', '<', now())->orWhere('created_at', '<', now()->subDays(30)))->delete();
        $plain = Str::random(80);
        DB::table('pos_access_tokens')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $user->id, 'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addDays(30), 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['token' => $plain, 'user' => ['id' => $user->uuid, 'name' => $user->name, 'email' => $user->email], 'outlet' => $outlet]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if ($token) DB::table('pos_access_tokens')->where('token_hash', hash('sha256', $token))->delete();
        return response()->json(['message' => 'Logout POS berhasil.']);
    }
}
