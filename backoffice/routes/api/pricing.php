<?php

use App\Http\Controllers\MaterialPriceController;
use App\Http\Controllers\ProductPriceController;
use App\Http\Controllers\PromotionController;
use Illuminate\Support\Facades\Route;

Route::prefix('product-prices')->middleware('permission:settings.manage')->group(function () {
    Route::get('/', [ProductPriceController::class, 'index']);
    Route::get('/options', [ProductPriceController::class, 'options']);
    Route::post('/', [ProductPriceController::class, 'store']);
    Route::patch('/{id}/close', [ProductPriceController::class, 'closePeriod']);
    Route::patch('/{id}/prices', [ProductPriceController::class, 'updateBatchPrices']);
    Route::post('/{id}/sizes', [ProductPriceController::class, 'addSizes']);
    Route::put('/{id}', [ProductPriceController::class, 'update']);
    Route::delete('/{id}', [ProductPriceController::class, 'destroy']);
});

Route::middleware('permission:settings.manage')->group(function () {
    Route::get('/promotions', [PromotionController::class, 'promotions']);
    Route::post('/promotions', [PromotionController::class, 'storePromotion']);
    Route::put('/promotions/{id}', [PromotionController::class, 'updatePromotion']);
    Route::delete('/promotions/{id}', [PromotionController::class, 'deletePromotion']);
    Route::get('/promotion-options', [PromotionController::class, 'options']);
    Route::get('/product-promotions', [PromotionController::class, 'productPromotions']);
    Route::post('/product-promotions', [PromotionController::class, 'storeProductPromotion']);
    Route::put('/product-promotions/{id}', [PromotionController::class, 'updateProductPromotion']);
    Route::delete('/product-promotions/{id}', [PromotionController::class, 'deleteProductPromotion']);
    Route::get('/product-bundles', [PromotionController::class, 'bundles']);
    Route::post('/product-bundles', [PromotionController::class, 'storeBundle']);
    Route::put('/product-bundles/{id}', [PromotionController::class, 'updateBundle']);
    Route::delete('/product-bundles/{id}', [PromotionController::class, 'deleteBundle']);
});

Route::prefix('material-prices')->middleware('permission:settings.manage')->group(function () {
    Route::get('/', [MaterialPriceController::class, 'index']);
    Route::get('/options', [MaterialPriceController::class, 'options']);
    Route::post('/', [MaterialPriceController::class, 'store']);
    Route::put('/{id}', [MaterialPriceController::class, 'update']);
    Route::delete('/{id}', [MaterialPriceController::class, 'destroy']);
});
