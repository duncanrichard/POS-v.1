<?php

use App\Http\Controllers\MasterData\WarehouseController;
use Illuminate\Support\Facades\Route;

Route::apiResource('warehouses', WarehouseController::class)->only(['index', 'store', 'update', 'destroy']);
