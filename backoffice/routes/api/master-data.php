<?php

use Illuminate\Support\Facades\Route;

Route::prefix('master-data')->middleware('permission:settings.manage')->group(function () {
    require __DIR__.'/master-data/categories.php';
    require __DIR__.'/master-data/products.php';
    require __DIR__.'/master-data/add-ons.php';
    require __DIR__.'/master-data/ingredient-modifiers.php';
    require __DIR__.'/master-data/material-categories.php';
    require __DIR__.'/master-data/materials.php';
    require __DIR__.'/master-data/units.php';
    require __DIR__.'/master-data/suppliers.php';
    require __DIR__.'/master-data/warehouses.php';
    require __DIR__.'/master-data/stations.php';
    require __DIR__.'/master-data/tables.php';
    require __DIR__.'/master-data/positions.php';
});
