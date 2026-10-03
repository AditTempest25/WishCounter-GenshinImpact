<?php

namespace Tests\Feature;

use App\Models\{GenshinAccount, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HoyolabBuildSyncTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        return ['uid' => '800001234', 'cookie' => 'secret', 'characters' => [[
            'base' => ['id' => 10000002, 'level' => 90, 'actived_constellation_num' => 0, 'fetter' => 10, 'cookie' => 'secret'],
            'weapon' => ['name' => 'Sword', 'cookie' => 'secret'], 'relics' => [], 'skills' => [],
            'base_properties' => [['property_type' => 1, 'final' => '1000', 'cookie' => 'secret']],
            'extra_properties' => [], 'element_properties' => [],
        ]], 'property_map' => [1 => ['name' => 'Max HP', 'property_type' => 1, 'cookie' => 'secret']]];
    }

    private function begin(): string
    {
        $owner = User::factory()->create();
        GenshinAccount::create(['user_id' => $owner->id, 'uid' => '800001234']);
        $this->actingAs($owner, 'sanctum');
        return $this->postJson('/api/accounts/800001234/build-sync')->assertCreated()->json('token');
    }

    public function test_owner_scope_projection_and_single_use(): void
    {
        $token = $this->begin();
        $owner = auth()->user();
        $this->getJson('/api/build-sync-sessions/'.$token.'/target')->assertOk()->assertJsonPath('uid', '800001234');
        $this->actingAs(User::factory()->create(), 'sanctum');
        $this->getJson('/api/build-sync-sessions/'.$token)->assertNotFound();
        $this->getJson('/api/accounts/800001234/hoyolab-builds')->assertNotFound();
        $this->postJson('/api/accounts/800001234/build-sync')->assertNotFound();
        $this->postJson('/api/build-sync-sessions/'.$token.'/cancel')->assertNotFound();
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $this->fixture())->assertOk();
        $stored = DB::table('genshin_accounts')->value('build_snapshot');
        $this->assertStringNotContainsString('secret', $stored);
        $this->assertStringNotContainsString('cookie', $stored);
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $this->fixture())->assertConflict();
        $this->actingAs($owner, 'sanctum')->getJson('/api/accounts/800001234/hoyolab-builds')
            ->assertOk()->assertJsonPath('snapshot.characters.0.base.id', 10000002);
        $this->getJson('/api/build-sync-sessions/'.$token)->assertJsonPath('status', 'completed');
    }

    public function test_mismatched_uid_and_malformed_properties_do_not_overwrite(): void
    {
        $token = $this->begin();
        $data = $this->fixture(); $data['uid'] = '800009999';
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $data)->assertUnprocessable();
        $data = $this->fixture(); $data['characters'][0]['base_properties'][0]['final'] = ['cookie' => 'secret'];
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $data)->assertUnprocessable();
        $this->assertNull(DB::table('genshin_accounts')->value('build_snapshot'));
    }

    public function test_cancel_expiry_and_unknown_tokens_reject_uploads(): void
    {
        $token = $this->begin();
        $this->postJson('/api/build-sync-sessions/'.$token.'/cancel')->assertOk();
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $this->fixture())->assertConflict();
        $this->getJson('/api/build-sync-sessions/'.str_repeat('a', 64).'/target')->assertNotFound();
        $this->travel(16)->minutes();
        $this->getJson('/api/build-sync-sessions/'.$token.'/target')->assertGone();
    }

    public function test_logout_revokes_pending_build_capability(): void
    {
        $token = $this->begin();
        $this->postJson('/api/auth/logout')->assertOk();
        $this->getJson('/api/build-sync-sessions/'.$token.'/target')->assertConflict();
    }

    public function test_empty_optional_stat_values_from_hoyolab_are_accepted(): void
    {
        $token = $this->begin();
        $data = $this->fixture();
        $data['characters'][0]['base_properties'][0]['base'] = '';
        $data['characters'][0]['base_properties'][0]['add'] = '';
        $data['characters'][0]['weapon']['main_property'] = ['property_type' => 1, 'value' => '608', 'base' => null];
        $data['characters'][0]['weapon']['icon'] = '';
        $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $data)->assertOk();
        $this->getJson('/api/accounts/800001234/hoyolab-builds')->assertOk()
            ->assertJsonPath('snapshot.characters.0.base_properties.0.base', null)
            ->assertJsonPath('snapshot.characters.0.base_properties.0.final', '1000');
    }

    public function test_validation_diagnostics_include_only_field_names(): void
    {
        $token = $this->begin();
        $data = $this->fixture(); $data['characters'][0]['base']['level'] = 'private-invalid-value';
        $response = $this->postJson('/api/build-sync-sessions/'.$token.'/builds', $data)->assertUnprocessable();
        $this->assertStringNotContainsString('private-invalid-value', $response->getContent());
        $this->getJson('/api/build-sync-sessions/'.$token)->assertOk()->assertJsonPath('status', 'failed');
        $this->assertStringContainsString('base.level', $response->json('message'));
        $this->assertNull(DB::table('genshin_accounts')->value('build_snapshot'));
    }

    public function test_failed_and_older_sessions_keep_the_new_snapshot(): void
    {
        $older = $this->begin();
        $this->travel(2)->seconds();
        $newer = $this->postJson('/api/accounts/800001234/build-sync')->assertCreated()->json('token');
        $this->postJson('/api/build-sync-sessions/'.$newer.'/builds', $this->fixture())->assertOk();
        $data = $this->fixture(); $data['characters'][0]['base']['level'] = 1;
        $this->postJson('/api/build-sync-sessions/'.$older.'/builds', $data)->assertConflict();
        $this->postJson('/api/build-sync-sessions/'.$older.'/failed')->assertOk();
        $this->getJson('/api/accounts/800001234/hoyolab-builds')->assertJsonPath('snapshot.characters.0.base.level', 90);
    }
}
