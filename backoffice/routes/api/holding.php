<?php

use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\HoldingController;
use Illuminate\Support\Facades\Route;

Route::prefix('holding')->middleware('permission:holding.manage')->group(function () {
    Route::get('/', [HoldingController::class, 'index']);
    Route::get('/stores', [HoldingController::class, 'stores']);
    Route::post('/stores', [HoldingController::class, 'storeOutlet']);
    Route::put('/stores/{id}', [HoldingController::class, 'updateOutlet']);
    Route::delete('/stores/{id}', [HoldingController::class, 'destroyOutlet']);
    Route::post('/users', [HoldingController::class, 'storeUser']);
});

Route::get('/geocoding/reverse', [GeocodingController::class, 'reverse'])
    ->middleware('permission:holding.manage');
