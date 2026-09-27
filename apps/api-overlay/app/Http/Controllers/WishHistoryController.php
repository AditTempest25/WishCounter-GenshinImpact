<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Services\RateUpService;
use App\Services\WishAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishHistoryController extends Controller
{
    public function index(Request $request, string $uid, RateUpService $rateUp, WishAnalyticsService $analytics): JsonResponse
    {
        $filters = $request->validate([
            'banner' => ['sometimes', 'in:100,200,301,302,500'],
            'rarity' => ['sometimes', 'integer', 'in:3,4,5'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'in:10,20,50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'kind' => ['sometimes', 'in:character,weapon'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d'],
            'item' => ['sometimes', 'string', 'max:32'],
        ]);
        if (isset($filters['from'], $filters['to']) && $filters['to'] < $filters['from']) {
            throw \Illuminate\Validation\ValidationException::withMessages(['to' => 'Tanggal akhir harus setelah tanggal awal.']);
        }
        $account = GenshinAccount::where('uid', $uid)->firstOrFail();
        $rateHistory = $rateUp->forAccount($account)['history'];
        $pity = $analytics->forAccount($account)['pity'];
        $query = $account->wishes();
        if (isset($filters['banner'])) {
            $query->where('uigf_gacha_type', $filters['banner']);
        }
        if (isset($filters['rarity'])) {
            $query->where('rank_type', $filters['rarity']);
        }
        if (!empty($filters['search'])) {
            $search = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower(trim($filters['search'])));
            $query->whereRaw("LOWER(item_name) LIKE ? ESCAPE '!'", ['%'.$search.'%']);
        }
        if (isset($filters['kind'])) {
            $kinds = $filters['kind'] === 'character' ? ['character', 'karakter'] : ['weapon', 'senjata'];
            $query->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(item_type)'), $kinds);
        }
        if (isset($filters['from'])) $query->where('wish_time', '>=', $filters['from'].' 00:00:00');
        if (isset($filters['to'])) $query->where('wish_time', '<=', $filters['to'].' 23:59:59');
        if (isset($filters['item'])) {
            $item = $account->wishes()->where('wish_id', $filters['item'])->firstOrFail();
            $query->where(function ($q) use ($item) {
                if ($item->item_id) {
                    $q->where('item_id', $item->item_id)->orWhere(function ($legacy) use ($item) {
                        $legacy->where(fn ($missing) => $missing->whereNull('item_id')->orWhere('item_id', ''))
                            ->where('item_name', $item->item_name)->where('item_type', $item->item_type);
                    });
                } else {
                    $q->where('item_name', $item->item_name)->where('item_type', $item->item_type);
                }
            });
        }
        $page = $query->orderByDesc('wish_time')->orderByDesc('wish_id')
            ->paginate($filters['per_page'] ?? 20, ['wish_id', 'item_id', 'gacha_type', 'uigf_gacha_type', 'item_name', 'item_type', 'rank_type', 'wish_time']);

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
                'pity' => $pity[$wish->wish_id] ?? null,
            ])->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }
}
