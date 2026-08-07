<?php

use App\Http\Controllers\RecipeController;
use Illuminate\Support\Facades\Route;

Route::prefix('recipes')->middleware('permission:settings.manage')->group(function () {
    Route::get('/', [RecipeController::class, 'index']);
    Route::get('/options', [RecipeController::class, 'options']);
    Route::post('/', [RecipeController::class, 'store']);
    Route::put('/{id}', [RecipeController::class, 'update']);
    Route::delete('/{id}', [RecipeController::class, 'destroy']);
});
