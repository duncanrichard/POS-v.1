<?php

use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

Route::get('/stock', [StockController::class, 'index'])
    ->middleware('permission:inventory.view');
