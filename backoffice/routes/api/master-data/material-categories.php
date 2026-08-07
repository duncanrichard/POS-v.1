<?php

use App\Http\Controllers\MasterData\MaterialCategoryController;
use Illuminate\Support\Facades\Route;

Route::apiResource('material-categories', MaterialCategoryController::class)->only(['index', 'store', 'update', 'destroy']);
