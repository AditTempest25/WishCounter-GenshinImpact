<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Models\SyncSession;
use App\Services\PityService;
use App\Services\RateUpService;
use App\Services\WishAnalyticsService;
use Illuminate\Http\JsonResponse;

class AccountStatsController extends Controller
{
    public function show(string $uid, PityService $pity, RateUpService $rateUp, WishAnalyticsService $analytics): JsonResponse
    {
        $account = GenshinAccount::where('uid', $uid)->firstOrFail();
        $analysis = $analytics->forAccount($account);
        $latestSync = SyncSession::where('uid', $account->uid)->where('status', 'completed')
            ->whereNotNull('completed_at')->orderByDesc('completed_at')->orderByDesc('id')->first();

        return response()->json([
            'uid' => $account->uid,
            'region' => $account->region,
            'last_synced_at' => $latestSync?->completed_at?->toIso8601String(),
            'last_sync_summary' => $latestSync?->summary,
            'analytics' => ['overall' => $analysis['summary'], 'banners' => $analysis['groups']],
            'total_wishes' => $account->wishes()->count(),
            'banners' => $pity->forAccount($account),
            'next_guarantee' => $rateUp->forAccount($account)['next'],
        ]);
    }
}
