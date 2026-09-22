<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Models\SyncSession;
use App\Models\Wish;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncSessionController extends Controller
{
    public function store(): JsonResponse
    {
        $token = Str::random(64);

        $session = SyncSession::create([
            'token_hash' => hash('sha256', $token),
            'status' => 'waiting',
            'expires_at' => now()->addMinutes(15),
        ]);

        return response()->json([
            'token' => $token,
            'status' => $session->status,
            'protocol_uri' => 'irminsul://sync?session='.rawurlencode($token),
            'expires_at' => $session->expires_at->toIso8601String(),
        ], 201);
    }

    public function show(string $token): JsonResponse
    {
        $session = $this->findSession($token);

        if ($session->expires_at->isPast() && ! in_array($session->status, ['completed', 'failed'], true)) {
            $session->update([
                'status' => 'failed',
                'message' => 'Sync session expired. Start a new sync.',
            ]);
        }

        return response()->json([
            'token' => $token,
            'status' => $session->status,
            'expires_at' => $session->expires_at->toIso8601String(),
            'new_wishes' => $session->new_wishes,
            'uid' => $session->uid,
            'message' => $session->message,
        ]);
    }

    public function upload(Request $request, string $token): JsonResponse
    {
        $session = $this->findSession($token);

        if ($session->expires_at->isPast()) {
            return response()->json(['message' => 'Sync session expired.'], 410);
        }

        $payload = $request->validate([
            'source' => ['required', 'string', 'max:64'],
            'uid' => ['nullable', 'string', 'max:32'],
            'region' => ['nullable', 'string', 'max:32'],
            'wishes' => ['present', 'array', 'max:50000'],
            'wishes.*.id' => ['required', 'string', 'max:32'],
            'wishes.*.gacha_type' => ['required', 'string', 'max:8'],
            'wishes.*.uigf_gacha_type' => ['required', 'string', 'max:8'],
            'wishes.*.item_id' => ['nullable', 'string', 'max:64'],
            'wishes.*.name' => ['required', 'string', 'max:255'],
            'wishes.*.item_type' => ['required', 'string', 'max:64'],
            'wishes.*.rank_type' => ['required', 'string', 'regex:/^[1-5]$/'],
            'wishes.*.time' => ['required', 'date_format:Y-m-d H:i:s'],
        ]);

        if (count($payload['wishes']) > 0 && empty($payload['uid'])) {
            return response()->json(['message' => 'UID is required when wish records are present.'], 422);
        }

        [$account, $newCount] = DB::transaction(function () use ($payload) {
            $account = null;
            $newCount = 0;

            if (! empty($payload['uid'])) {
                $account = GenshinAccount::firstOrCreate(
                    ['uid' => $payload['uid']],
                    ['region' => $payload['region'] ?? null]
                );

                if (! empty($payload['region']) && $account->region !== $payload['region']) {
                    $account->update(['region' => $payload['region']]);
                }

                foreach ($payload['wishes'] as $record) {
                    $wish = Wish::firstOrCreate(
                        [
                            'genshin_account_id' => $account->id,
                            'wish_id' => $record['id'],
                        ],
                        [
                            'gacha_type' => $record['gacha_type'],
                            'uigf_gacha_type' => $record['uigf_gacha_type'],
                            'item_id' => $record['item_id'] ?? null,
                            'item_name' => $record['name'],
                            'item_type' => $record['item_type'],
                            'rank_type' => (int) $record['rank_type'],
                            'wish_time' => $record['time'],
                        ]
                    );

                    if ($wish->wasRecentlyCreated) $newCount++;
                }
            }

            return [$account, $newCount];
        });

        $session->update([
            'status' => 'completed',
            'uid' => $account?->uid,
            'new_wishes' => $newCount,
            'message' => $newCount > 0 ? "Imported {$newCount} new wishes." : 'No new wishes were found.',
            'completed_at' => now(),
        ]);

        return response()->json([
            'status' => 'completed',
            'uid' => $account?->uid,
            'new_wishes' => $newCount,
        ]);
    }

    private function findSession(string $token): SyncSession
    {
        return SyncSession::where('token_hash', hash('sha256', $token))->firstOrFail();
    }
}
