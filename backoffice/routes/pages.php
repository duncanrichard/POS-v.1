<?php

use App\Http\Controllers\PublicTableController;
use Illuminate\Support\Facades\Route;

Route::get('/public/tables/{token}', [PublicTableController::class, 'show'])->middleware('throttle:60,1');

Route::view('/{path?}', 'app')
    ->middleware('auth')
    ->where('path', '^(?!api).*$');
