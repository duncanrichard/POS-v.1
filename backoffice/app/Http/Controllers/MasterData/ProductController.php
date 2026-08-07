<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Http\Controllers\MasterDataController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoint produk dipisahkan agar route dan tanggung jawab menu eksplisit.
 * Workflow SKU, gambar, dan varian tetap didelegasikan sementara ke layanan legacy
 * sampai modul katalog dipindahkan penuh tanpa mengubah kontrak POS.
 */
class ProductController extends Controller
{
    public function __construct(private readonly MasterDataController $legacy) {}

    public function index(Request $request): JsonResponse
    {
        return $this->legacy->index($request, 'products');
    }

    public function store(Request $request): JsonResponse
    {
        return $this->legacy->store($request, 'products');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->legacy->update($request, 'products', $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->legacy->destroy($request, 'products', $id);
    }
}
