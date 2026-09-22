<?php

namespace Tests\Feature;

use App\Models\SyncSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_hashes_token_imports_deduplicates_and_calculates_shared_pity(): void
    {
        $created = $this->postJson('/api/sync-sessions')->assertCreated()->json();
        $token = $created['token'];
        $this->assertDatabaseHas('sync_sessions', ['token_hash' => hash('sha256', $token)]);
        $this->assertDatabaseMissing('sync_sessions', ['token_hash' => $token]);
        $this->assertSame('irminsul://sync?session='.$token, $created['protocol_uri']);
        $record = [
            'id' => '1000000000000000001', 'gacha_type' => '301',
            'uigf_gacha_type' => '301', 'item_id' => '1', 'name' => 'Test five star',
            'item_type' => 'Character', 'rank_type' => '5', 'time' => '2026-09-21 10:00:00',
        ];
        $later = array_replace($record, [
            'id' => '1000000000000000002', 'gacha_type' => '400',
            'name' => 'Test weapon', 'item_type' => 'Weapon', 'rank_type' => '3',
            'time' => '2026-09-21 10:01:00',
        ]);
        $payload = ['source' => 'windows-companion', 'uid' => '800000001', 'wishes' => [$record, $later]];
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)
            ->assertOk()->assertJsonPath('new_wishes', 2);
        $this->getJson("/api/sync-sessions/$token")
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('uid', '800000001');
        $second = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$second/wishes", $payload)
            ->assertOk()->assertJsonPath('new_wishes', 0);
        $this->assertDatabaseCount('wishes', 2);
        $this->getJson('/api/accounts/800000001/stats')->assertOk()
            ->assertJsonPath('total_wishes', 2)
            ->assertJsonPath('banners.301.current_pity', 1)
            ->assertJsonPath('banners.301.last_5_star.item_id', '1')
            ->assertJsonPath('banners.301.last_5_star.name', 'Test five star');
    }

    public function test_empty_history_completes_without_creating_an_account(): void
    {
        $token = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$token/wishes", ['source' => 'windows-companion', 'wishes' => []])
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('new_wishes', 0);
        $this->assertDatabaseCount('genshin_accounts', 0);
    }

    public function test_dashboard_cards_reflect_imports_and_latest_successful_sync(): void
    {
        $this->travelTo(now()->startOfSecond());
        $records = [];
        foreach (['200', '301', '302', '500'] as $index => $type) {
            $records[] = [
                'id' => (string) (1000 + $index), 'gacha_type' => $type,
                'uigf_gacha_type' => $type, 'name' => "Five star $type",
                'item_type' => $type === '302' ? 'Weapon' : 'Character',
                'rank_type' => '5', 'time' => '2026-09-21 10:00:00',
            ];
        }
        $payload = ['source' => 'windows-companion', 'uid' => '800000002', 'wishes' => $records];
        $token = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)->assertOk();
        $firstSync = now()->toIso8601String();
        $response = $this->getJson('/api/accounts/800000002/stats')->assertOk()
            ->assertJsonPath('total_wishes', 4)
            ->assertJsonPath('last_synced_at', $firstSync);
        foreach (['200', '301', '302', '500'] as $type) {
            $response->assertJsonPath("banners.$type.total_wishes", 1)
                ->assertJsonPath("banners.$type.current_pity", 0)
                ->assertJsonPath("banners.$type.last_5_star.name", "Five star $type");
        }

        $this->travel(1)->minutes();
        $token = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)
            ->assertOk()->assertJsonPath('new_wishes', 0);
        $lastSync = now()->toIso8601String();
        $this->travel(1)->minutes();
        // Waiting/failed sessions and another account must not change this account's timestamp.
        $token = $this->postJson('/api/sync-sessions')->json('token');
        SyncSession::where('token_hash', hash('sha256', $token))->update([
            'uid' => '800000002', 'status' => 'failed', 'completed_at' => now(),
        ]);
        $other = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$other/wishes", array_replace($payload, ['uid' => '800000003']))->assertOk();
        $this->getJson('/api/accounts/800000002/stats')->assertOk()
            ->assertJsonPath('total_wishes', 4)->assertJsonPath('last_synced_at', $lastSync);
    }

    public function test_expired_and_unknown_tokens_cannot_upload(): void
    {
        $token = $this->postJson('/api/sync-sessions')->json('token');
        SyncSession::query()->update(['expires_at' => now()->subMinute()]);
        $payload = ['source' => 'windows-companion', 'wishes' => []];
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)->assertStatus(410);
        $this->getJson("/api/sync-sessions/$token")->assertJsonPath('status', 'failed');
        $this->postJson('/api/sync-sessions/unknown/wishes', $payload)->assertNotFound();
        $this->assertDatabaseCount('wishes', 0);
    }
}
