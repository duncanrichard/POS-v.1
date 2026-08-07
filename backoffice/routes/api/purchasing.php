<?php

use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\GoodsReceiptController;
use Illuminate\Support\Facades\Route;

Route::prefix('purchase-orders')->middleware('permission:purchasing.manage')->group(function () {
    Route::get('/notifications', [PurchasingController::class, 'notifications']);
    Route::post('/notifications/read', [PurchasingController::class, 'readNotifications']);
    Route::post('/notifications/{id}/read', [PurchasingController::class, 'readNotification']);
    Route::get('/', [PurchasingController::class, 'index']);
    Route::get('/options', [PurchasingController::class, 'options']);
    Route::get('/{id}', [PurchasingController::class, 'show']);
    Route::post('/', [PurchasingController::class, 'store']);
    Route::post('/{id}/submit', [PurchasingController::class, 'submit']);
    Route::patch('/{id}/decision', [PurchasingController::class, 'decision'])
        ->middleware('permission:purchasing.approve');
});

Route::prefix('goods-receipts')->middleware('permission:inventory.manage')->group(function () {
    Route::get('/', [GoodsReceiptController::class, 'index']);
    Route::get('/purchase-orders/{purchaseOrderId}', [GoodsReceiptController::class, 'show']);
    Route::get('/{id}', [GoodsReceiptController::class, 'receipt']);
    Route::post('/', [GoodsReceiptController::class, 'store']);
});
