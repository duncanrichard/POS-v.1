<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt([...$credentials, 'status' => 'active'], $request->boolean('remember')) || ! in_array($request->user()->account_channel, ['backoffice', 'both'], true)) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => 'Email atau password yang Anda masukkan tidak sesuai.',
            ]);
        }

        $request->session()->regenerate();

        return response()->json([
            'message' => 'Login berhasil.',
            'user' => $request->user()->only('id', 'name', 'email'),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $outlet = $request->user()->outlet_id
            ? DB::table('outlets')->where('id', $request->user()->outlet_id)
                ->first(['id', 'code', 'name'])
            : null;
        return response()->json([
            ...$request->user()->only('id', 'name', 'email', 'company_id', 'outlet_id'),
            'roles' => $request->user()->getRoleNames(),
            'permissions' => $request->user()->getAllPermissions()->pluck('name'),
            'scope' => $request->user()->outlet_id ? 'store' : 'holding',
            'outlet' => $outlet,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout berhasil.']);
    }
}
