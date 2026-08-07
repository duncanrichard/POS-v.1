<?php

use App\Http\Controllers\AccessManagementController;
use Illuminate\Support\Facades\Route;

Route::prefix('access')->middleware('permission:roles.manage')->group(function () {
    Route::get('/', [AccessManagementController::class, 'index']);
    Route::post('/roles', [AccessManagementController::class, 'storeRole']);
    Route::put('/roles/{role}', [AccessManagementController::class, 'updateRole']);
    Route::post('/permissions', [AccessManagementController::class, 'storePermission']);
    Route::post('/accounts', [AccessManagementController::class, 'storeAccount']);
});
