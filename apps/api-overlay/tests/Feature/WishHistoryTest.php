<?php

namespace Tests\Feature;

use App\Models\GenshinAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WishHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_history_is_paginated_filtered_and_scoped_to_the_account(): void
    {
        $account = GenshinAccount::create(['uid' => '800000010']);
        for ($index = 1; $index <= 25; $index++) {
            $account->wishes()->create([
                'wish_id' => (string) (1000 + $index), 'gacha_type' => $index % 2 ? '400' : '302',
                'uigf_gacha_type' => $index % 2 ? '301' : '302', 'item_name' => "Wish $index",
                'item_id' => '11520', 'item_type' => 'Weapon', 'rank_type' => $index % 2 ? 5 : 3,
                'wish_time' => '2026-09-21 10:00:00',
            ]);
        }
        $other = GenshinAccount::create(['uid' => '800000011']);
        $other->wishes()->create([
            'wish_id' => '9999', 'gacha_type' => '301', 'uigf_gacha_type' => '301',
            'item_name' => 'Other account', 'item_type' => 'Character', 'rank_type' => 5,
            'wish_time' => '2026-09-22 10:00:00',
        ]);
        $this->getJson('/api/accounts/800000010/wishes')->assertOk()
            ->assertJsonCount(20, 'data')->assertJsonPath('total', 25)
            ->assertJsonPath('last_page', 2)->assertJsonPath('data.0.id', '1025')
            ->assertJsonPath('data.0.item_id', '11520')->assertJsonPath('data.0.gacha_type', '400')->assertJsonPath('data.0.rarity', 5);
        $this->getJson('/api/accounts/800000010/wishes?page=2')->assertOk()
            ->assertJsonCount(5, 'data')->assertJsonPath('current_page', 2)->assertJsonPath('data.0.id', '1005');
        $this->getJson('/api/accounts/800000010/wishes?banner=301&rarity=5')->assertOk()
            ->assertJsonCount(13, 'data')->assertJsonPath('total', 13)->assertJsonPath('data.0.banner', '301');
        $this->getJson('/api/accounts/800000010/wishes?banner=302&rarity=5')->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('total', 0);
        $this->getJson('/api/accounts/800000010/wishes?banner=100')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/accounts/unknown/wishes')->assertNotFound();
        foreach (['page=0', 'rarity=9', 'banner=400', 'page=abc'] as $query) {
            $this->getJson('/api/accounts/800000010/wishes?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/accounts/800000010/stats')->assertOk()->assertJsonPath('last_synced_at', null);
    }
}
