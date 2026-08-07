<?php

use App\Http\Controllers\MasterData\PositionController;
use Illuminate\Support\Facades\Route;

Route::apiResource('positions', PositionController::class)->only(['index', 'store', 'update', 'destroy']);
