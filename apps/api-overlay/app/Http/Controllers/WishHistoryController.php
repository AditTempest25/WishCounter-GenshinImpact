<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Services\RateUpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishHistoryController extends Controller
{
    public function index(Request $request, string $uid, RateUpService $rateUp): JsonResponse
    {
        $filters = $request->validate([
            'banner' => ['sometimes', 'in:100,200,301,302,500'],
            'rarity' => ['sometimes', 'integer', 'in:3,4,5'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $account = GenshinAccount::where('uid', $uid)->firstOrFail();
        $rateHistory = $rateUp->forAccount($account)['history'];
        $query = $account->wishes();
        if (isset($filters['banner'])) {
            $query->where('uigf_gacha_type', $filters['banner']);
        }
        if (isset($filters['rarity'])) {
            $query->where('rank_type', $filters['rarity']);
        }
        $page = $query->orderByDesc('wish_time')->orderByDesc('wish_id')
            ->paginate(20, ['wish_id', 'item_id', 'gacha_type', 'uigf_gacha_type', 'item_name', 'item_type', 'rank_type', 'wish_time']);

        return response()->json([
            'data' => $page->getCollection()->map(fn ($wish) => [
                'id' => $wish->wish_id,
                'item_id' => $wish->item_id,
                'banner' => $wish->uigf_gacha_type,
                'gacha_type' => $wish->gacha_type,
                'name' => $wish->item_name,
                'item_type' => $wish->item_type,
                'rarity' => (int) $wish->rank_type,
                'time' => $wish->wish_time,
                'rate_up' => $rateHistory[$wish->wish_id] ?? null,
            ])->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }
}
