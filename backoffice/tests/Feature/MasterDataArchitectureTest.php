<?php

namespace Tests\Feature;

use App\Http\Controllers\MasterData\DiningTableController;
use App\Http\Controllers\MasterData\MaterialController;
use App\Http\Controllers\MasterData\ProductController;
use App\Models\DiningTable;
use App\Models\Material;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class MasterDataArchitectureTest extends TestCase
{
    public function test_core_models_expose_their_domain_relations(): void
    {
        $this->assertInstanceOf(HasMany::class, (new Outlet)->diningTables());
        $this->assertInstanceOf(BelongsTo::class, (new DiningTable)->outlet());
        $this->assertInstanceOf(BelongsTo::class, (new Material)->category());
        $this->assertInstanceOf(HasMany::class, (new Product)->variants());
        $this->assertInstanceOf(BelongsTo::class, (new Order)->outlet());
    }

    public function test_table_qr_relation_can_be_eager_loaded_with_postgresql_uuid_keys(): void
    {
        $relation = (new DiningTable)->activeQrCode();

        $this->assertFalse($relation->isOneOfMany(), 'Relasi UUID tidak boleh memakai latestOfMany/MAX(uuid) pada PostgreSQL.');
    }

    public function test_master_data_routes_use_resource_specific_controllers(): void
    {
        $actions = collect(Route::getRoutes())->mapWithKeys(fn ($route) => [$route->uri() => $route->getActionName()]);

        $this->assertStringContainsString(DiningTableController::class, $actions['api/master-data/tables']);
        $this->assertStringContainsString(MaterialController::class, $actions['api/master-data/materials']);
        $this->assertStringContainsString(ProductController::class, $actions['api/master-data/products']);
    }
}
