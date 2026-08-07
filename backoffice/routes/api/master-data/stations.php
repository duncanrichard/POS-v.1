<?php

use App\Http\Controllers\MasterData\KitchenStationController;
use Illuminate\Support\Facades\Route;

Route::apiResource('stations', KitchenStationController::class)->only(['index', 'store', 'update', 'destroy']);
