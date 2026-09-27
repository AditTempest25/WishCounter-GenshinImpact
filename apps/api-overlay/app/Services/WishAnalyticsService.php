<?php

namespace App\Services;

use App\Models\GenshinAccount;

class WishAnalyticsService
{
    public function forAccount(GenshinAccount $account): array
    {
        $summary = ['five_stars' => 0, 'four_stars' => 0, 'interval_count' => 0,
            'average_pity' => null, 'fastest_pity' => null, 'longest_pity' => null];
        $groups = [];
        $pulls = [];
        $seen = [];
        $intervals = [];
        $pity = [];
        foreach ($account->wishes()->orderBy('wish_time')->orderBy('wish_id')
            ->get(['wish_id', 'uigf_gacha_type', 'rank_type']) as $wish) {
            $group = (string) $wish->uigf_gacha_type;
            $groups[$group] ??= ['five_stars' => 0, 'four_stars' => 0];
            $pulls[$group] = ($pulls[$group] ?? 0) + 1;
            if ((int) $wish->rank_type === 4) {
                $summary['four_stars']++;
                $groups[$group]['four_stars']++;
            }
            if ((int) $wish->rank_type !== 5) continue;
            $summary['five_stars']++;
            $groups[$group]['five_stars']++;
            $complete = $seen[$group] ?? false;
            $pity[$wish->wish_id] = ['pulls' => $pulls[$group], 'complete' => $complete];
            // Beginners' Wish has different mechanics and is excluded from interval metrics.
            if ($complete && $group !== '100') $intervals[$group][] = $pulls[$group];
            $seen[$group] = true;
            $pulls[$group] = 0;
        }
        $allIntervals = [];
        foreach ($groups as $group => &$metrics) {
            $values = $intervals[$group] ?? [];
            $metrics = array_merge($metrics, $this->intervalMetrics($values));
            array_push($allIntervals, ...$values);
        }
        unset($metrics);
        return ['summary' => array_merge($summary, $this->intervalMetrics($allIntervals)),
            'groups' => $groups, 'pity' => $pity];
    }

    private function intervalMetrics(array $values): array
    {
        return ['interval_count' => count($values),
            'average_pity' => $values ? round(array_sum($values) / count($values), 1) : null,
            'fastest_pity' => $values ? min($values) : null,
            'longest_pity' => $values ? max($values) : null];
    }
}
