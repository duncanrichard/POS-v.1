<?php

use App\Http\Controllers\MasterData\DiningTableController;
use Illuminate\Support\Facades\Route;

Route::apiResource('tables', DiningTableController::class)->only(['index', 'store', 'update', 'destroy']);
