<?php

namespace Tests\Feature;

use App\Models\GenshinAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ArchiveRecoveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(\App\Models\User::factory()->create(), "sanctum");
    }

    private function archive(): array
    {
        return ['format' => 'irminsul-archive', 'version' => 1,
            'account' => ['uid' => '800000080', 'region' => 'os_asia'],
            'wishes' => [
                ['id' => '100', 'gacha_type' => '400', 'item_id' => '10000116', 'name' => 'Ineffa', 'item_type' => 'Character', 'rank_type' => '5', 'time' => '2026-09-17 12:00:00'],
                ['id' => '101', 'gacha_type' => '301', 'item_id' => '11301', 'name' => 'Cool Steel', 'item_type' => 'Weapon', 'rank_type' => '3', 'time' => '2026-09-18 12:00:00'],
            ]];
    }

    public function test_backup_restores_exact_records_and_duplicate_import_preserves_stats(): void
    {
        $this->postJson('/api/archives/import', $this->archive())->assertOk()->assertJsonPath('added', 2);
        $before = $this->getJson('/api/accounts/800000080/stats')->assertOk()->json();
        $backup = $this->getJson('/api/accounts/800000080/archive')->assertOk()->json();
        $this->assertSame($this->archive()['wishes'], $backup['wishes']);
        $this->postJson('/api/archives/import', $backup)->assertOk()->assertJsonPath('added', 0)->assertJsonPath('duplicates', 2);
        $this->assertSame($before, $this->getJson('/api/accounts/800000080/stats')->json());
        GenshinAccount::where('uid', '800000080')->first()->wishes()->delete();
        $this->postJson('/api/archives/import', $backup)->assertOk()->assertJsonPath('added', 2);
        $this->assertSame($before, $this->getJson('/api/accounts/800000080/stats')->json());
        $this->assertSame(1, $before['banners']['301']['current_pity']);
        $this->assertSame(2, $before['analytics']['months']['2026-09']['301']);
    }

    public function test_invalid_or_conflicting_backup_rolls_back_without_changing_existing_archive(): void
    {
        $data = $this->archive();
        $this->postJson('/api/archives/import', $data)->assertOk();
        $bad = $data;
        $bad['wishes'][0]['id'] = '099'; // Would be a new row before the conflicting record.
        $bad['wishes'][1]['rank_type'] = '5';
        $this->postJson('/api/archives/import', $bad)->assertUnprocessable();
        $this->assertDatabaseCount('wishes', 2);
        foreach (['id' => 9007199254740992, 'time' => 'invalid', 'gacha_type' => '999'] as $field => $value) {
            $bad = $data; $bad['wishes'][0][$field] = $value;
            $this->postJson('/api/archives/import', $bad)->assertUnprocessable();
        }
        $bad = $data; $bad['wishes'][] = $bad['wishes'][0];
        $this->postJson('/api/archives/import', $bad)->assertUnprocessable();
        $bad = $data; $bad['version'] = 2;
        $this->postJson('/api/archives/import', $bad)->assertUnprocessable();
        $this->assertDatabaseCount('wishes', 2);
    }

    public function test_progress_is_allowlisted_and_terminal_states_cannot_be_reopened(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJsonPath('status', 'ok');
        $token = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson("/api/sync-sessions/$token/progress", ['stage' => 'connected'])->assertOk();
        $this->getJson("/api/sync-sessions/$token")->assertJsonPath('status', 'syncing');
        $this->postJson("/api/sync-sessions/$token/progress", ['stage' => 'secret-url'])->assertUnprocessable();
        $this->postJson("/api/sync-sessions/$token/progress", ['stage' => 'game_closed'])->assertOk();
        $this->getJson("/api/sync-sessions/$token")->assertJsonPath('status', 'failed');
        $this->postJson("/api/sync-sessions/$token/progress", ['stage' => 'connected'])->assertConflict();
        $this->postJson("/api/sync-sessions/$token/wishes", ['source' => 'test', 'wishes' => []])->assertConflict();
        $this->postJson('/api/sync-sessions/missing/progress', ['stage' => 'connected'])->assertNotFound();
        $token = $this->postJson('/api/sync-sessions')->json('token');
        $payload = ['source' => 'test', 'uid' => '800000080', 'wishes' => array_map(fn ($row) => [...$row, 'uigf_gacha_type' => '301'], $this->archive()['wishes'])];
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)->assertOk()->assertJsonPath('new_wishes', 2);
        $this->postJson("/api/sync-sessions/$token/wishes", $payload)->assertOk()->assertJsonPath('new_wishes', 2);
        $this->assertDatabaseCount('wishes', 2);
        $this->postJson("/api/sync-sessions/$token/progress", ['stage' => 'failed'])->assertConflict();
        $this->getJson("/api/sync-sessions/$token")->assertJsonPath('status', 'completed')->assertJsonPath('summary.new_wishes', 2);
    }
}
