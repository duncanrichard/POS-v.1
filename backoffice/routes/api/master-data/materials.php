<?php

use App\Http\Controllers\MasterData\MaterialController;
use Illuminate\Support\Facades\Route;

Route::apiResource('materials', MaterialController::class)->only(['index', 'store', 'update', 'destroy']);
