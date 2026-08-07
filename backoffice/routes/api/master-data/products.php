<?php

use App\Http\Controllers\MasterData\ProductController;
use Illuminate\Support\Facades\Route;

Route::apiResource('products', ProductController::class)->only(['index', 'store', 'update', 'destroy']);
