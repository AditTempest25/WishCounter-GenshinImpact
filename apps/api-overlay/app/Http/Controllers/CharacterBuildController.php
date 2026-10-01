<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use Illuminate\Support\Facades\{Cache, Http};
use Illuminate\Http\Client\ConnectionException;

class CharacterBuildController extends Controller
{
    public function show(string $uid)
    {
        abort_unless(preg_match('/^[0-9]{6,20}$/', $uid), 404);
        GenshinAccount::where('user_id', auth()->id())->where('uid', $uid)->firstOrFail();
        $key = 'showcase:v1:'.$uid;
        if ($cached = Cache::get($key)) return response()->json($cached);
        // Prevent overlapping refreshes from consuming the upstream rate limit.
        $lock = Cache::lock($key.':lock', 30);
        if (! $lock->get()) return response()->json(['message' => 'Showcase sedang dimuat. Coba sebentar lagi.'], 429);
        try {
            if ($cached = Cache::get($key)) return response()->json($cached);
            $response = Http::withHeaders(['User-Agent' => 'IrminsulWish/1.0 (github.com/AditTempest25/WishCounter-GenshinImpact)'])
                ->acceptJson()->connectTimeout(5)->timeout(18)->get('https://enka.network/api/uid/'.$uid.'/');
            if (! $response->successful()) {
                $status = $response->status();
                return response()->json(['message' => match ($status) {
                    404 => 'UID belum ditemukan oleh Enka.',
                    429 => 'Enka sedang membatasi permintaan. Coba lagi nanti.',
                    424 => 'Data game sedang dalam pemeliharaan.',
                    default => 'Showcase belum bisa dihubungi. Coba lagi nanti.',
                }], in_array($status, [404, 429]) ? $status : 502);
            }
            $data = $response->json();
            if (! is_array($data) || ! isset($data['playerInfo'])) return response()->json(['message' => 'Data showcase belum tersedia.'], 502);
            $ttl = max(60, (int) ($data['ttl'] ?? 300));
            $result = [
                'characters' => array_slice($data['avatarInfoList'] ?? [], 0, 24),
                'fetched_at' => now()->toIso8601String(),
                'refresh_after' => now()->addSeconds($ttl)->toIso8601String(),
            ];
            Cache::put($key, $result, $ttl);
            return response()->json($result);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'Enka belum merespons. Coba lagi nanti.'], 504);
        } finally {
            $lock->release();
        }
    }
}
