<?php

namespace App\Services;

use App\Models\GenshinAccount;
use App\Models\Wish;

class RateUpService
{
    private array $banners;
    private array $items;

    public function __construct()
    {
        $this->banners = json_decode(ltrim(file_get_contents(resource_path('data/banner-history.json')), "\xEF\xBB\xBF"), true, 512, JSON_THROW_ON_ERROR)['banners'];
        $this->items = json_decode(file_get_contents(resource_path('data/item-catalog.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    public function forAccount(GenshinAccount $account): array
    {
        $history = [];
        $next = ['301' => 'unknown', '302' => 'unknown'];
        $wishes = $account->wishes()->where('rank_type', 5)
            ->whereIn('uigf_gacha_type', ['301', '302'])
            ->orderBy('wish_time')->orderBy('wish_id')->get();
        foreach ($wishes as $wish) {
            $group = (string) $wish->uigf_gacha_type;
            $result = $this->classify($wish);
            $previous = $next[$group];
            $history[$wish->wish_id] = [
                'result' => $result,
                'guaranteed_before' => $previous === 'unknown' ? null : $previous === 'guaranteed',
                'label' => match (true) {
                    $result === 'off' => 'Rate off',
                    $result === 'on' && $previous === 'guaranteed' => 'Rate on · Guaranteed',
                    $result === 'on' => 'Rate on',
                    default => 'Belum diketahui',
                },
            ];
            $next[$group] = match ($result) {
                'off' => 'guaranteed',
                'on' => 'not_guaranteed',
                default => 'unknown',
            };
        }
        return ['history' => $history, 'next' => $next];
    }

    private function classify(Wish $wish): string
    {
        $date = substr($wish->wish_time, 0, 10);
        $group = (string) $wish->uigf_gacha_type;
        $featured = [];
        foreach ($this->banners as $banner) {
            if ($banner['group'] !== $group) continue;
            // Boundary dates differ by server timezone; do not guess during a transition.
            if ($date === $banner['start'] || $date === $banner['end']) return 'unknown';
            if ($date > $banner['start'] && $date < $banner['end']) {
                $featured = array_merge($featured, $banner['featured']);
            }
        }
        if (!$featured) return 'unknown';
        $name = $this->items[$wish->item_id] ?? strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $wish->item_name));
        if (in_array($name, $featured, true)) return 'on';
        // Only permanent-pool items can be off-banner. An unexpected limited item means
        // the metadata is incomplete or inconsistent; never convert that into a guarantee.
        $standard = $group === '301'
            ? ['jean', 'diluc', 'mona', 'qiqi', 'keqing', 'tighnari', 'dehya', 'yumemizukimizuki']
            : ['aquilafavonia', 'skywardblade', 'wolfsgravestone', 'skywardpride', 'primordialjadewingedspear', 'skywardspine', 'lostprayertothesacredwinds', 'skywardatlas', 'amosbow', 'skywardharp'];
        return in_array($name, $standard, true) ? 'off' : 'unknown';
    }
}
