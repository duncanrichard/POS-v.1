<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class GeocodingController extends Controller
{
    public function reverse(Request $request): JsonResponse
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $cacheKey = sprintf('reverse-geocode:%.5f:%.5f', $data['latitude'], $data['longitude']);
        $result = Cache::remember($cacheKey, now()->addDays(30), function () use ($data) {
            $response = Http::acceptJson()
                ->withHeaders([
                    'User-Agent' => 'POSphere-Backoffice/1.0',
                    'Accept-Language' => 'id',
                ])
                ->timeout(10)
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'format' => 'jsonv2',
                    'lat' => $data['latitude'],
                    'lon' => $data['longitude'],
                    'zoom' => 18,
                    'addressdetails' => 1,
                    'layer' => 'address',
                ]);

            if (! $response->successful()) {
                return null;
            }

            return [
                'address' => $response->json('display_name'),
                'details' => $response->json('address', []),
            ];
        });

        if (! $result || ! $result['address']) {
            return response()->json(['message' => 'Alamat tidak ditemukan untuk titik tersebut.'], 404);
        }

        return response()->json($result);
    }
}
