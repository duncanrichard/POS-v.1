<?php

use App\Http\Controllers\MasterData\AddOnController;
use Illuminate\Support\Facades\Route;

Route::apiResource('add-ons', AddOnController::class)->only(['index', 'store', 'update', 'destroy']);
