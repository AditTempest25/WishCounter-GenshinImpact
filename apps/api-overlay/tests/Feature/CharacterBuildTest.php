<?php

namespace Tests\Feature;

use App\Models\{GenshinAccount, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache, Http};
use Tests\TestCase;

class CharacterBuildTest extends TestCase
{
    use RefreshDatabase;

    public function test_showcase_is_owner_scoped_and_cached_until_upstream_ttl(): void
    {
        Http::preventStrayRequests();
        Http::fake(['enka.network/*' => Http::response(['playerInfo' => ['nickname' => 'Not forwarded'], 'ttl' => 600, 'avatarInfoList' => [['avatarId' => 10000002]]])]);
        $owner = User::factory()->create();
        GenshinAccount::create(['user_id' => $owner->id, 'uid' => '800001234']);
        $this->getJson('/api/accounts/800001234/builds')->assertUnauthorized();
        $this->actingAs(User::factory()->create(), 'sanctum')->getJson('/api/accounts/800001234/builds')->assertNotFound();
        Http::assertNothingSent();
        $this->actingAs($owner, 'sanctum')->getJson('/api/accounts/800001234/builds')
            ->assertOk()->assertJsonPath('characters.0.avatarId', 10000002)->assertJsonMissingPath('playerInfo');
        $this->getJson('/api/accounts/800001234/builds')->assertOk();
        Http::assertSentCount(1);
        $this->travel(601)->seconds();
        $this->getJson('/api/accounts/800001234/builds')->assertOk();
        Http::assertSentCount(2);
    }

    public function test_hidden_showcase_and_upstream_failure_have_safe_responses(): void
    {
        $owner = User::factory()->create();
        GenshinAccount::create(['user_id' => $owner->id, 'uid' => '800001235']);
        $this->actingAs($owner, 'sanctum');
        Http::fake(['enka.network/*' => Http::sequence()
            ->push(['playerInfo' => [], 'ttl' => 60])->push(['private' => 'upstream detail'], 429)]);
        $this->getJson('/api/accounts/800001235/builds')->assertOk()->assertJsonPath('characters', []);
        Cache::forget('showcase:v1:800001235');
        $this->getJson('/api/accounts/800001235/builds')->assertStatus(429)->assertJsonMissingPath('private');
    }
}
