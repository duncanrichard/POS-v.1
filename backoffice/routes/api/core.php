<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::get('/me', [AuthController::class, 'me']);
Route::get('/dashboard', DashboardController::class);
Route::get('/reports', [ReportController::class, 'index'])->middleware('permission:reports.view');
Route::get('/reports/export', [ReportController::class, 'export'])->middleware('permission:reports.export');
