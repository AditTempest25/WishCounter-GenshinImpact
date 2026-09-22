<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Models\SyncSession;
use App\Services\PityService;
use App\Services\RateUpService;
use Illuminate\Http\JsonResponse;

class AccountStatsController extends Controller
{
    public function show(string $uid, PityService $pity, RateUpService $rateUp): JsonResponse
    {
        $account = GenshinAccount::where('uid', $uid)->firstOrFail();

        return response()->json([
            'uid' => $account->uid,
            'region' => $account->region,
            'last_synced_at' => SyncSession::where('uid', $account->uid)
                ->where('status', 'completed')
                ->whereNotNull('completed_at')
                ->orderByDesc('completed_at')
                ->first()?->completed_at?->toIso8601String(),
            'total_wishes' => $account->wishes()->count(),
            'banners' => $pity->forAccount($account),
            'next_guarantee' => $rateUp->forAccount($account)['next'],
        ]);
    }
}
