<?php

use App\Http\Controllers\MasterData\IngredientModifierController;
use Illuminate\Support\Facades\Route;

Route::apiResource('ingredient-modifiers', IngredientModifierController::class)->only(['index', 'store', 'update', 'destroy']);
