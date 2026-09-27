<?php

namespace Tests\Feature;

use App\Models\GenshinAccount;
use App\Services\WishAnalyticsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardInsightsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(\App\Models\User::factory()->create(), "sanctum");
    }

    private function wish($account, string $id, string $group, int $rarity, string $name = 'Ineffa', ?string $itemId = '10000116', string $kind = 'Karakter', string $date = '2026-09-17 12:00:00', ?string $raw = null): void
    {
        $account->wishes()->create(['wish_id' => $id, 'gacha_type' => $raw ?? $group,
            'uigf_gacha_type' => $group, 'item_name' => $name, 'item_id' => $itemId,
            'item_type' => $kind, 'rank_type' => $rarity, 'wish_time' => $date]);
    }

    public function test_intervals_keep_banner_groups_separate_and_exclude_initial_partial_history(): void
    {
        $account = GenshinAccount::create(['user_id' => auth()->id(), 'uid' => '800000040']);
        $this->wish($account, '1', '301', 3);
        $this->wish($account, '2', '301', 5, raw: '400');
        $this->wish($account, '3', '302', 5);
        $this->wish($account, '4', '301', 4);
        $this->wish($account, '5', '301', 5);
        $this->wish($account, '6', '301', 5);
        $this->wish($account, '7', '200', 3);
        $this->wish($account, '8', '200', 5);
        $stats = app(WishAnalyticsService::class)->forAccount($account);
        $this->assertSame(5, $stats['summary']['five_stars']);
        $this->assertSame(1, $stats['summary']['four_stars']);
        $this->assertSame(1.5, $stats['summary']['average_pity']);
        $this->assertSame(2, $stats['summary']['interval_count']);
        $this->assertSame(1, $stats['summary']['fastest_pity']);
        $this->assertSame(2, $stats['summary']['longest_pity']);
        $this->assertSame(['pulls' => 2, 'complete' => false], $stats['pity']['2']);
        $this->assertSame(['pulls' => 2, 'complete' => true], $stats['pity']['5']);
        $this->assertSame(1, $stats['groups']['200']['five_stars']);
        $this->assertNull($stats['groups']['200']['average_pity']);
        $this->getJson('/api/accounts/800000040/wishes?rarity=5&banner=301&per_page=10')
            ->assertOk()->assertJsonPath('data.0.pity.pulls', 1)
            ->assertJsonPath('data.1.pity.pulls', 2)->assertJsonPath('data.2.pity.complete', false);
        $this->getJson('/api/accounts/800000040/stats')->assertOk()
            ->assertJsonPath('analytics.overall.average_pity', 1.5);
    }

    public function test_filters_and_item_details_are_literal_inclusive_and_account_scoped(): void
    {
        $account = GenshinAccount::create(['user_id' => auth()->id(), 'uid' => '800000041']);
        $other = GenshinAccount::create(['user_id' => auth()->id(), 'uid' => '800000042']);
        $this->wish($account, '100', '301', 5, date: '2026-09-17 00:00:00');
        $this->wish($account, '101', '200', 5, itemId: null, date: '2026-09-17 23:59:59');
        $this->wish($account, '102', '302', 4, 'Magic 100%', '22', 'Senjata', '2026-09-18 00:00:00');
        $this->wish($account, '103', '302', 4, 'Magic 100x', '23', 'Weapon', '2026-09-18 00:00:00');
        $this->wish($other, '999', '301', 5);
        $this->getJson('/api/accounts/800000041/wishes?search=ineffa&kind=character&from=2026-09-17&to=2026-09-17&per_page=10')
            ->assertOk()->assertJsonPath('total', 2)->assertJsonPath('per_page', 10);
        $this->getJson('/api/accounts/800000041/wishes?search=100%25&kind=weapon')->assertOk()
            ->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'Magic 100%');
        $this->getJson('/api/accounts/800000041/wishes?item=100')->assertOk()->assertJsonPath('total', 2);
        $this->getJson('/api/accounts/800000041/wishes?item=999')->assertNotFound();
        foreach (['per_page=1000', 'kind=other', 'from=2026-09-18&to=2026-09-17', 'from=invalid'] as $query) {
            $this->getJson('/api/accounts/800000041/wishes?'.$query)->assertUnprocessable();
        }
    }

    public function test_empty_and_beginners_history_do_not_fabricate_an_average(): void
    {
        $account = GenshinAccount::create(['user_id' => auth()->id(), 'uid' => '800000043']);
        $empty = app(WishAnalyticsService::class)->forAccount($account);
        $this->assertNull($empty['summary']['average_pity']);
        $this->assertSame(0, $empty['summary']['five_stars']);
        $this->wish($account, '1', '100', 5);
        $this->wish($account, '2', '100', 5);
        $this->assertNull(app(WishAnalyticsService::class)->forAccount($account)['summary']['average_pity']);
    }
}
