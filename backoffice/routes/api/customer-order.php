<?php

use App\Http\Controllers\CustomerOrder\CustomerOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('customer')->middleware('throttle:90,1')->group(function () {
    Route::get('/tables/{token}/catalog', [CustomerOrderController::class, 'catalog']);
    Route::post('/tables/{token}/orders', [CustomerOrderController::class, 'store'])->middleware('throttle:20,1');
    Route::post('/orders/{order}/midtrans', [CustomerOrderController::class, 'createMidtrans'])->middleware('throttle:20,1');
    Route::post('/orders/{order}/midtrans/verify', [CustomerOrderController::class, 'verifyMidtrans'])->middleware('throttle:30,1');
    Route::post('/orders/{order}/midtrans/simulate', [CustomerOrderController::class, 'simulateMidtrans'])->middleware('throttle:20,1');
    Route::get('/orders/{order}', [CustomerOrderController::class, 'show']);
});

Route::post('/payments/midtrans/notification', [CustomerOrderController::class, 'midtransNotification'])->middleware('throttle:120,1');
