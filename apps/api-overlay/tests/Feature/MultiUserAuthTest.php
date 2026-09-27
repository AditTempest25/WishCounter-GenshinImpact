<?php

namespace Tests\Feature;

use App\Models\{User, GenshinAccount, SyncSession};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MultiUserAuthTest extends TestCase
{
    use RefreshDatabase;

    private function register(string $email): string
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', '');
        return $this->postJson('/api/auth/register', ['name' => 'Archive owner', 'email' => $email,
            'password' => 'Test-only-password-123', 'password_confirmation' => 'Test-only-password-123'])
            ->assertCreated()->json('token');
    }
    private function token(string $token): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token);
    }
    private function archive(): array
    {
        return ['format' => 'irminsul-archive', 'version' => 1, 'account' => ['uid' => '800000123'],
            'wishes' => [['id' => '123456', 'gacha_type' => '301', 'name' => 'Private item', 'item_type' => 'Character',
                'rank_type' => '5', 'time' => '2026-09-17 12:00:00']]];
    }

    public function test_guests_and_other_users_cannot_read_archives_or_poll_sessions(): void
    {
        foreach (['auth/me', 'accounts/800000123/stats', 'accounts/800000123/wishes', 'accounts/800000123/archive', 'sync-sessions/unknown'] as $path) $this->getJson('/api/'.$path)->assertUnauthorized();
        $this->postJson('/api/sync-sessions')->assertUnauthorized();
        $this->postJson('/api/archives/import', $this->archive())->assertUnauthorized();
        $a = $this->register('owner-a@example.test');
        $b = $this->register('owner-b@example.test');
        $this->token($a);
        $this->postJson('/api/archives/import', $this->archive())->assertOk()->assertJsonPath('added', 1);
        $session = $this->postJson('/api/sync-sessions')->assertCreated()->json('token');
        $this->token($b);
        foreach (['stats', 'wishes', 'archive'] as $endpoint) $this->getJson('/api/accounts/800000123/'.$endpoint)->assertNotFound();
        $this->getJson('/api/sync-sessions/'.$session)->assertNotFound();
        $this->getJson('/api/auth/me')->assertJsonCount(0, 'accounts');
        // Same game UID is a separate private copy, never a claim on someone else's records.
        $copy = $this->archive(); $copy['wishes'] = [];
        $copy['user_id'] = User::where('email', 'owner-a@example.test')->value('id');
        $this->postJson('/api/archives/import', $copy)->assertOk();
        $this->getJson('/api/accounts/800000123/stats')->assertJsonPath('total_wishes', 0);
        $this->token($a);
        $this->getJson('/api/accounts/800000123/stats')->assertJsonPath('total_wishes', 1);
    }

    public function test_companion_upload_owner_is_taken_from_session_and_logout_revokes_pending_sync(): void
    {
        $a = $this->register('a@example.test'); $b = $this->register('b@example.test');
        $this->token($a);
        $session = $this->postJson('/api/sync-sessions')->json('token');
        $this->token($b);
        $payload = ['source' => 'test', 'uid' => '800000123', 'user_id' => User::where('email', 'b@example.test')->value('id'),
            'wishes' => array_map(fn ($row) => [...$row, 'uigf_gacha_type' => '302'], $this->archive()['wishes'])];
        $this->postJson('/api/sync-sessions/'.$session.'/wishes', $payload)->assertOk();
        $this->getJson('/api/accounts/800000123/stats')->assertNotFound();
        $this->token($a);
        $this->getJson('/api/accounts/800000123/stats')->assertJsonPath('banners.301.total_wishes', 1)->assertJsonPath('banners.302.total_wishes', 0);
        $pending = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson('/api/auth/logout')->assertOk();
        $this->token($a); $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/sync-sessions/'.$pending.'/wishes', $payload)->assertConflict();
        $this->postJson('/api/sync-sessions/'.$pending.'/progress', ['stage' => 'connected'])->assertConflict();
    }

    public function test_legacy_archive_is_not_claimed_by_registration_and_requires_explicit_assignment(): void
    {
        $legacy = GenshinAccount::create(['uid' => '800000123']);
        $token = $this->register('local-owner@example.test'); $this->token($token);
        $this->getJson('/api/accounts/800000123/stats')->assertNotFound();
        $this->artisan('irminsul:assign-legacy', ['email' => 'local-owner@example.test', 'uid' => '800000123'])->assertSuccessful();
        $this->getJson('/api/accounts/800000123/stats')->assertOk();
        $this->assertNotNull($legacy->fresh()->user_id);
    }

    public function test_password_change_and_expiry_revoke_tokens_and_password_is_hashed(): void
    {
        $first = $this->register('password@example.test');
        $user = User::first(); $this->assertTrue(Hash::check('Test-only-password-123', $user->password));
        $second = $user->createToken('other', ['*'], now()->addDays(7))->plainTextToken;
        $this->token($first);
        $this->postJson('/api/auth/password', ['current_password' => 'wrong', 'password' => 'New-test-password-123', 'password_confirmation' => 'New-test-password-123'])->assertUnprocessable();
        $this->postJson('/api/auth/password', ['current_password' => 'Test-only-password-123', 'password' => 'New-test-password-123', 'password_confirmation' => 'New-test-password-123'])->assertOk();
        foreach ([$first, $second] as $token) { $this->token($token); $this->getJson('/api/auth/me')->assertUnauthorized(); }
        $expired = $user->createToken('expired', ['*'], now()->subMinute())->plainTextToken;
        $this->token($expired); $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_login_validation_and_failed_attempt_limit(): void
    {
        $this->register('login@example.test');
        $this->postJson('/api/auth/login', ['email' => 'LOGIN@example.test', 'password' => 'Test-only-password-123'])->assertOk()->assertJsonStructure(['token', 'user']);
        for ($i = 0; $i < 5; $i++) $this->postJson('/api/auth/login', ['email' => 'login@example.test', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 'login@example.test', 'password' => 'wrong'])->assertStatus(429);
        $this->postJson('/api/auth/register', ['name' => 'Bad', 'email' => 'bad@example.test', 'password' => 'short', 'password_confirmation' => 'different'])->assertUnprocessable();
    }

    public function test_completed_companion_capability_also_expires(): void
    {
        $token = $this->register('expiry@example.test'); $this->token($token);
        $session = $this->postJson('/api/sync-sessions')->json('token');
        $this->postJson('/api/sync-sessions/'.$session.'/wishes', ['source' => 'test', 'wishes' => []])->assertOk();
        $this->travel(16)->minutes();
        $this->postJson('/api/sync-sessions/'.$session.'/wishes', ['source' => 'test', 'wishes' => []])->assertStatus(410);
    }
}
