<?php

namespace Tests\Feature;

use App\Models\GenshinAccount;
use App\Services\RateUpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RateUpTest extends TestCase
{
    use RefreshDatabase;

    private function addWish($account, string $id, string $name, string $date, string $group = '301', string $raw = '301'): void
    {
        $account->wishes()->create([
            'wish_id' => $id, 'gacha_type' => $raw, 'uigf_gacha_type' => $group,
            'item_name' => $name, 'item_type' => 'Character', 'rank_type' => 5,
            'wish_time' => $date.' 12:00:00',
        ]);
    }

    public function test_guarantee_follows_shared_banner_history_and_survives_history_filters(): void
    {
        $account = GenshinAccount::create(['uid' => '800000020']);
        $this->addWish($account, '1001', 'Mona', '2020-10-01');
        $this->addWish($account, '1002', 'Venti', '2020-10-02', '301', '400');
        $this->addWish($account, '1003', 'Venti', '2020-10-03');
        $this->addWish($account, '1004', 'Diluc', '2020-10-04');
        $this->addWish($account, '1005', 'Skyward Atlas', '2020-10-05', '302', '302');
        $result = app(RateUpService::class)->forAccount($account);
        $this->assertSame('off', $result['history']['1001']['result']);
        $this->assertNull($result['history']['1001']['guaranteed_before']);
        $this->assertSame('Rate on · Guaranteed', $result['history']['1002']['label']);
        $this->assertFalse($result['history']['1003']['guaranteed_before']);
        $this->assertSame('guaranteed', $result['next']['301']);
        $this->assertSame('guaranteed', $result['next']['302']);
        $this->getJson('/api/accounts/800000020/wishes?banner=301&rarity=5')->assertOk()
            ->assertJsonPath('data.0.rate_up.result', 'off')
            ->assertJsonPath('data.2.rate_up.guaranteed_before', true);
        $this->getJson('/api/accounts/800000020/stats')->assertOk()
            ->assertJsonPath('next_guarantee.301', 'guaranteed');
    }

    public function test_featured_standard_character_is_rate_on_and_unknown_history_is_not_assumed(): void
    {
        $account = GenshinAccount::create(['uid' => '800000021']);
        $this->addWish($account, '1001', 'Keqing', '2021-02-20');
        $result = app(RateUpService::class)->forAccount($account);
        $this->assertSame('on', $result['history']['1001']['result']);
        $this->assertNull($result['history']['1001']['guaranteed_before']);
        $this->assertSame('not_guaranteed', $result['next']['301']);
        $this->assertSame('unknown', $result['next']['302']);
        $this->addWish($account, '1002', 'Keqing', '2021-03-02');
        $this->assertSame('unknown', app(RateUpService::class)->forAccount($account)['next']['301']);
        $this->addWish($account, '1003', 'Mona', '2030-01-01');
        $this->assertSame('unknown', app(RateUpService::class)->forAccount($account)['history']['1003']['result']);
    }
}
