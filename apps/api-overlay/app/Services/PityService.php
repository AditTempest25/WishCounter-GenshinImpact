<?php

namespace App\Services;

use App\Models\GenshinAccount;

class PityService
{
    private const BANNER_CAPS = [
        '100' => 20,
        '200' => 90,
        '301' => 90,
        '302' => 80,
        '500' => 90,
    ];

    public function forAccount(GenshinAccount $account): array
    {
        $result = [];

        foreach (self::BANNER_CAPS as $type => $cap) {
            $wishes = $account->wishes()
                ->where('uigf_gacha_type', $type)
                ->orderByDesc('wish_time')
                ->orderByDesc('wish_id')
                ->get(['wish_id', 'item_id', 'item_name', 'item_type', 'rank_type', 'wish_time']);

            $pity = 0;
            $lastFiveStar = null;

            foreach ($wishes as $wish) {
                if ((int) $wish->rank_type === 5) {
                    $lastFiveStar = [
                        'name' => $wish->item_name,
                        'item_id' => $wish->item_id,
                        'item_type' => $wish->item_type,
                        'time' => $wish->wish_time,
                    ];
                    break;
                }
                $pity++;
            }

            $result[$type] = [
                'current_pity' => $pity,
                'hard_pity' => $cap,
                'total_wishes' => $wishes->count(),
                'last_5_star' => $lastFiveStar,
            ];
        }

        return $result;
    }
}
