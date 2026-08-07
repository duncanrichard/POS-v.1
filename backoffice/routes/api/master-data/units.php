<?php

use App\Http\Controllers\MasterData\UnitController;
use Illuminate\Support\Facades\Route;

Route::apiResource('units', UnitController::class)->only(['index', 'store', 'update', 'destroy']);
