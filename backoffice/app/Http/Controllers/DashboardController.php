<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'period' => 'Hari ini, 30 Jul 2026',
            'outlet' => 'Jakarta Selatan',
            'metrics' => [
                ['label' => 'Penjualan bersih', 'value' => 'Rp 0', 'change' => '0%', 'trend' => 'neutral'],
                ['label' => 'Total pesanan', 'value' => '0', 'change' => '0%', 'trend' => 'neutral'],
                ['label' => 'Open bill', 'value' => '0', 'change' => 'Rp 0', 'trend' => 'neutral'],
                ['label' => 'Rata-rata order', 'value' => 'Rp 0', 'change' => '0%', 'trend' => 'neutral'],
            ],
            'sales' => [],
            'channels' => [],
            'kitchen' => [],
            'stockAlerts' => [],
            'activities' => [],
        ]);
    }
}
