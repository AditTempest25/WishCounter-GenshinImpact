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
    public function progress(Request $request, string $token): JsonResponse
    {
        $session = $this->findSession($token);
        if ($session->expires_at->isPast()) return response()->json(['message' => 'Sync session expired.'], 410);
        if (in_array($session->status, ['completed', 'failed'], true)) return response()->json(['message' => 'Session already finished.'], 409);
        $data = $request->validate(['stage' => ['required', 'in:connected,fetching,uploading,game_closed,history_missing,failed']]);
        $stage = $data['stage'];
        $messages = [
            'connected' => 'Companion terhubung. Memeriksa game dan Wish History…',
            'fetching' => 'Mengambil riwayat langsung dari HoYoverse…',
            'uploading' => 'Menyimpan arsip ke Irminsul…',
            'game_closed' => 'Genshin belum berjalan. Buka game lewat HoYoPlay, lalu mulai sync baru.',
            'history_missing' => 'Wish History belum ditemukan. Buka Wish → History sampai dimuat, lalu mulai sync baru.',
            'failed' => 'Companion gagal menyelesaikan sync. Periksa pesannya, muat ulang Wish History, lalu coba sesi baru.',
        ];
        $updated = SyncSession::whereKey($session->id)->whereIn('status', ['waiting', 'syncing'])->where('expires_at', '>', now())->update(['status' => in_array($stage, ['game_closed', 'history_missing', 'failed'], true) ? 'failed' : 'syncing', 'message' => $messages[$stage]]);
        abort_unless($updated, 409);
        $session->refresh();
        return response()->json(['status' => $session->status]);
    }

    public function store(): JsonResponse
    {
        $token = Str::random(64);

        $session = SyncSession::create([
            'user_id' => auth()->id(),
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
        abort_unless($session->user_id === auth()->id(), 404);

        if ($session->expires_at->isPast() && ! in_array($session->status, ['completed', 'failed'], true)) {
            SyncSession::whereKey($session->id)->whereIn('status', ['waiting', 'syncing'])->update([
                'status' => 'failed',
                'message' => 'Sync session expired. Start a new sync.',
            ]);
            $session->refresh();
        }

        return response()->json([
            'token' => $token,
            'status' => $session->status,
            'expires_at' => $session->expires_at->toIso8601String(),
            'new_wishes' => $session->new_wishes,
            'uid' => $session->uid,
            'message' => $session->message,
            'summary' => $session->summary,
        ]);
    }

    public function upload(Request $request, string $token): JsonResponse
    {
        $session = $this->findSession($token);

        if ($session->expires_at->isPast()) {
            return response()->json(['message' => 'Sync session expired.'], 410);
        }

        if ($session->status === 'completed') {
            return response()->json(['status' => 'completed', 'uid' => $session->uid, 'new_wishes' => $session->new_wishes]);
        }
        if ($session->status === 'failed') return response()->json(['message' => 'Start a new sync session.'], 409);


        $payload = $request->validate([
            'source' => ['required', 'string', 'max:64'],
            'uid' => ['nullable', 'string', 'regex:/^[0-9]{6,20}$/'],
            'region' => ['nullable', 'string', 'max:32'],
            'wishes' => ['present', 'array', 'max:50000'],
            'wishes.*.id' => ['required', 'string', 'max:32'],
            'wishes.*.gacha_type' => ['required', 'string', 'in:100,200,301,400,302,500'],
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

        return DB::transaction(function () use ($payload, $session) {
            $session = SyncSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            abort_if($session->status === 'failed', 409);
            abort_if($session->expires_at->isPast(), 410);
            if ($session->status === 'completed') return response()->json(['status' => 'completed', 'uid' => $session->uid, 'new_wishes' => $session->new_wishes]);
            $account = null;
            $newCount = 0;
            $summary = ['new_wishes' => 0, 'five_stars' => 0, 'four_stars' => 0, 'three_stars' => 0];

            if (! empty($payload['uid'])) {
                $account = GenshinAccount::firstOrCreate(
                    ['user_id' => $session->user_id, 'uid' => $payload['uid']],
                    ['region' => $payload['region'] ?? null]
                );

                if (! empty($payload['region']) && $account->region !== $payload['region']) {
                    $account->update(['region' => $payload['region']]);
                }

                // Serialize writers for this account, including concurrent sync sessions.
                GenshinAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
                $timestamp = now();
                foreach (array_chunk($payload['wishes'], 250) as $batch) {
                    $existing = Wish::where('genshin_account_id', $account->id)
                        ->whereIn('wish_id', array_column($batch, 'id'))->pluck('wish_id')->all();
                    $seen = array_fill_keys($existing, true);
                    $rows = [];
                    foreach ($batch as $record) {
                        if (isset($seen[$record['id']])) continue;
                        $seen[$record['id']] = true;
                        $rows[] = [
                            'genshin_account_id' => $account->id,
                            'wish_id' => $record['id'],
                            'gacha_type' => $record['gacha_type'],
                            'uigf_gacha_type' => $record['gacha_type'] === '400' ? '301' : $record['gacha_type'],
                            'item_id' => $record['item_id'] ?? null,
                            'item_name' => $record['name'],
                            'item_type' => $record['item_type'],
                            'rank_type' => (int) $record['rank_type'],
                            'wish_time' => $record['time'],
                            'created_at' => $timestamp,
                            'updated_at' => $timestamp,
                        ];
                        $newCount++;
                        $key = [3 => 'three_stars', 4 => 'four_stars', 5 => 'five_stars'][(int) $record['rank_type']] ?? null;
                        if ($key) $summary[$key]++;
                    }
                    if ($rows) Wish::insert($rows);
                }
            }

            $summary['new_wishes'] = $newCount;
        $session->update([
            'status' => 'completed',
            'uid' => $account?->uid,
            'new_wishes' => $newCount,
            'message' => $newCount > 0 ? "Imported {$newCount} new wishes." : 'No new wishes were found.',
            'completed_at' => now(),
            'summary' => $summary,
        ]);

        return response()->json([
            'status' => 'completed',
            'uid' => $account?->uid,
            'new_wishes' => $newCount,
        ]);
        });
    }

    private function findSession(string $token): SyncSession
    {
        return SyncSession::whereNotNull('user_id')->where('token_hash', hash('sha256', $token))->firstOrFail();
    }
}
