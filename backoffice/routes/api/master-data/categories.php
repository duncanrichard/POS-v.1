<?php

use App\Http\Controllers\MasterData\CategoryController;
use Illuminate\Support\Facades\Route;

Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);
