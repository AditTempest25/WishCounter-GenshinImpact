<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Services\PityService;
use Illuminate\Http\JsonResponse;

class AccountStatsController extends Controller
{
    public function show(string $uid, PityService $pity): JsonResponse
    {
        $account = GenshinAccount::where('uid', $uid)->firstOrFail();

        return response()->json([
            'uid' => $account->uid,
            'region' => $account->region,
            'total_wishes' => $account->wishes()->count(),
            'banners' => $pity->forAccount($account),
        ]);
    }
}
