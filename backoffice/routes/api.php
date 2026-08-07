<?php

use App\Http\Controllers\PosAuthController;
use App\Http\Controllers\PosCatalogController;
use App\Http\Controllers\PosOrderController;
use App\Http\Controllers\PosShiftController;
use Illuminate\Support\Facades\Route;

Route::post('/api/pos/login', [PosAuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/api/pos/logout', [PosAuthController::class, 'logout'])->middleware('throttle:20,1');

Route::prefix('api')->group(function () {
    require __DIR__.'/api/customer-order.php';
});

Route::middleware(['pos.auth', 'throttle:120,1'])->prefix('api/pos')->group(function () {
    Route::get('/catalog', PosCatalogController::class);
    Route::get('/shifts/current', [PosShiftController::class, 'status']);
    Route::post('/shifts/open', [PosShiftController::class, 'open']);
    Route::get('/shifts/{shift}', [PosShiftController::class, 'show']);
    Route::post('/shifts/{shift}/close', [PosShiftController::class, 'close']);
    Route::get('/orders', [PosOrderController::class, 'index']);
    Route::get('/orders/{order}', [PosOrderController::class, 'show']);
    Route::get('/self-service/orders', [PosOrderController::class, 'selfService']);
    Route::post('/self-service/orders/{order}/release-table', [PosOrderController::class, 'releaseSelfServiceTable']);
    Route::get('/tables', [PosOrderController::class, 'tables']);
    Route::post('/tables/{table}/release', [PosOrderController::class, 'releaseTable']);
    Route::post('/orders', [PosOrderController::class, 'store'])->middleware('throttle:30,1');
    Route::post('/orders/{order}/payments', [PosOrderController::class, 'pay'])->middleware('throttle:120,1');
    Route::get('/kitchen/tickets', [PosOrderController::class, 'kitchen']);
    Route::patch('/kitchen/tickets/{ticket}/status', [PosOrderController::class, 'kitchenStatus']);
});

Route::middleware('auth')->prefix('api')->group(function () {
    require __DIR__.'/api/core.php';
    require __DIR__.'/api/holding.php';
    require __DIR__.'/api/master-data.php';
    require __DIR__.'/api/purchasing.php';
    require __DIR__.'/api/recipes.php';
    require __DIR__.'/api/pricing.php';
    require __DIR__.'/api/inventory.php';
    require __DIR__.'/api/access.php';
});
