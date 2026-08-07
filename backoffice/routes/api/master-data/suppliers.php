<?php

use App\Http\Controllers\MasterData\SupplierController;
use Illuminate\Support\Facades\Route;

Route::apiResource('suppliers', SupplierController::class)->only(['index', 'store', 'update', 'destroy']);
