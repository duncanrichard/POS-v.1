<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatePosToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();
        abort_unless($plain, 401, 'Token POS diperlukan.');
        $token = DB::table('pos_access_tokens')->where('token_hash', hash('sha256', $plain))->first();
        abort_unless($token && (! $token->expires_at || now()->lte($token->expires_at)), 401, 'Sesi POS sudah tidak berlaku. Silakan login kembali.');
        $user = User::query()->whereKey($token->user_id)->where('status', 'active')->whereIn('account_channel', ['pos', 'both'])->first();
        abort_unless($user && $user->outlet_id, 403, 'Akun POS tidak aktif atau tidak memiliki cabang.');
        $active = DB::table('outlets')->where('id', $user->outlet_id)->where('company_id', $user->company_id)
            ->where('status', 'active')->whereNull('deleted_at')->exists();
        abort_unless($active, 403, 'Cabang akun tidak aktif.');
        DB::table('pos_access_tokens')->where('id', $token->id)->update(['last_used_at' => now(), 'updated_at' => now()]);
        $request->setUserResolver(fn () => $user);
        $request->attributes->set('pos_token_id', $token->id);
        return $next($request);
    }
}
