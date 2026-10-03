<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use Illuminate\Http\Request;
use Illuminate\Support\{Arr, Str, Carbon};
use Illuminate\Support\Facades\DB;

class BuildSyncController extends Controller
{
    public function store(string $uid)
    {
        $account = GenshinAccount::where('user_id', auth()->id())->where('uid', $uid)->firstOrFail();
        $token = Str::random(64);
        DB::table('build_sync_sessions')->insert([
            'genshin_account_id' => $account->id, 'token_hash' => hash('sha256', $token),
            'status' => 'waiting', 'expires_at' => now()->addMinutes(15), 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['token' => $token, 'protocol_uri' => 'irminsul://builds?session='.$token, 'expires_at' => now()->addMinutes(15)->toIso8601String()], 201);
    }

    private function session(string $token)
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{64}$/', $token), 404);
        $session = DB::table('build_sync_sessions')->where('token_hash', hash('sha256', $token))->first();
        abort_unless($session, 404);
        abort_if(now()->greaterThanOrEqualTo($session->expires_at), 410, 'Sesi build kedaluwarsa. Mulai lagi.');
        return $session;
    }

    public function show(string $token)
    {
        $session = $this->session($token);
        $account = GenshinAccount::findOrFail($session->genshin_account_id);
        abort_unless($account->user_id === auth()->id(), 404);
        return response()->json(['status' => $session->status, 'message' => $session->message]);
    }

    // A capability can read only its bound UID and upload a single snapshot.
    public function target(string $token)
    {
        $session = $this->session($token);
        abort_if($session->status !== 'waiting', 409);
        return response()->json(['uid' => GenshinAccount::findOrFail($session->genshin_account_id)->uid]);
    }

    public function snapshot(string $uid)
    {
        $account = GenshinAccount::where('user_id', auth()->id())->where('uid', $uid)->firstOrFail();
        return response()->json(['snapshot' => json_decode($account->getRawOriginal('build_snapshot') ?? 'null', true), 'fetched_at' => $account->build_synced_at]);
    }

    public function fail(string $token)
    {
        $session = $this->session($token);
        abort_if($session->status !== 'waiting', 409);
        $changed = DB::table('build_sync_sessions')->where('id', $session->id)->where('status', 'waiting')->update([
            'status' => 'failed', 'message' => 'Companion gagal atau login dibatalkan. Periksa pesan companion dan mulai sync baru.', 'updated_at' => now(),
        ]);
        abort_unless($changed, 409);
        return response()->json(['status' => 'failed']);
    }

    public function cancel(string $token)
    {
        $session = $this->session($token);
        abort_unless(GenshinAccount::whereKey($session->genshin_account_id)->where('user_id', auth()->id())->exists(), 404);
        return $this->fail($token);
    }

    public function upload(Request $request, string $token)
    {
        $session = $this->session($token);
        abort_if(strlen($request->getContent()) > 2 * 1024 * 1024, 413);
        $validator = validator($request->all(), [
            'uid' => ['required', 'string', 'regex:/^[0-9]{6,20}$/'],
            'characters' => ['required', 'array', 'min:1', 'max:200'],
            'characters.*' => ['required', 'array'],
            'characters.*.base' => ['required', 'array'],
            'characters.*.base.id' => ['required', 'integer', 'distinct', 'min:10000000'],
            'characters.*.base.level' => ['required', 'integer', 'between:1,100'],
            'characters.*.base.actived_constellation_num' => ['required', 'integer', 'between:0,6'],
            'characters.*.base.fetter' => ['required', 'integer', 'between:0,10'],
            'characters.*.weapon' => ['nullable', 'array'],
            'characters.*.relics' => ['present', 'array', 'max:5'],
            'characters.*.skills' => ['present', 'array', 'max:20'],
            'characters.*.base_properties' => ['present', 'array', 'max:40'],
            'characters.*.extra_properties' => ['present', 'array', 'max:40'],
            'characters.*.element_properties' => ['present', 'array', 'max:20'],
            'property_map' => ['required', 'array', 'max:100'],
            'property_map.*' => ['array'],
            'property_map.*.name' => ['required', 'string', 'max:80'],
            'characters.*.weapon.name' => ['sometimes', 'string', 'max:100'],
            'characters.*.weapon.icon' => ['sometimes', 'nullable', 'string', 'max:150', 'regex:/^(UI_|Skill_)[A-Za-z0-9_]+$/'],
            'characters.*.relics.*' => ['array'],
            'characters.*.relics.*.name' => ['required', 'string', 'max:100'],
            'characters.*.relics.*.icon' => ['sometimes', 'nullable', 'string', 'max:150', 'regex:/^(UI_|Skill_)[A-Za-z0-9_]+$/'],
            'characters.*.relics.*.sub_property_list' => ['present', 'array', 'max:4'],
            'characters.*.skills.*' => ['array'],
            'characters.*.base_properties.*' => ['array'],
            'characters.*.extra_properties.*' => ['array'],
            'characters.*.element_properties.*' => ['array'],
            'characters.*.relics.*.set' => ['sometimes', 'array'],
            'characters.*.relics.*.set.name' => ['sometimes', 'string', 'max:100'],
        ]);
        if ($validator->fails()) {
            // Expose field names only, never payload values or login credentials.
            $fields = array_slice(array_keys($validator->errors()->messages()), 0, 3);
            $message = 'Format build ditolak: '.implode(', ', $fields).'.';
            DB::table('build_sync_sessions')->where('id', $session->id)->where('status', 'waiting')
                ->update(['status' => 'failed', 'message' => substr($message, 0, 255), 'updated_at' => now()]);
            return response()->json(['message' => $message, 'fields' => $fields], 422);
        }
        $data = $validator->validated();
        // Reject nested credentials and non-scalar values rather than serializing them.
        $scalarFields = ['id', 'level', 'actived_constellation_num', 'fetter', 'element', 'name', 'rarity', 'affix_level', 'pos', 'skill_id', 'skill_type', 'property_type', 'base', 'add', 'final', 'value'];
        $check = function ($node, $path = '') use (&$check, $scalarFields) {
            foreach ($node as $key => $value) {
                if ($key === 'base' && preg_match('/^characters\.\d+$/', $path)) {
                    $check($value, $path.'.base');
                } elseif (in_array($key, $scalarFields, true)) {
                    // HoYoLAB uses empty strings for inapplicable base/add values.
                    // Laravel's ConvertEmptyStringsToNull middleware normalizes them to null.
                    abort_if($value !== null && (!is_scalar($value) || strlen((string) $value) > 150), 422, 'Nilai build tidak valid.');
                } elseif (is_array($value)) {
                    $check($value, $path === '' ? (string) $key : $path.'.'.$key);
                }
            }
        };
        $check($data);
        // Explicit field projection at every depth: credentials and profile data never persist.
        $prop = fn ($p) => Arr::only(is_array($p) ? $p : [], ['property_type', 'base', 'add', 'final', 'value']);
        $characters = array_map(function ($c) use ($prop) {
            $weapon = Arr::only($c['weapon'] ?? [], ['id', 'name', 'level', 'rarity', 'affix_level', 'icon']);
            $weapon['main_property'] = $prop($c['weapon']['main_property'] ?? []);
            $weapon['sub_property'] = $prop($c['weapon']['sub_property'] ?? []);
            return [
                'base' => Arr::only($c['base'], ['id', 'level', 'actived_constellation_num', 'fetter', 'element']),
                'weapon' => $weapon,
                'relics' => array_map(function ($a) use ($prop) {
                    return [...Arr::only($a, ['id', 'name', 'level', 'rarity', 'pos', 'icon']),
                        'set' => Arr::only($a['set'] ?? [], ['name']), 'main_property' => $prop($a['main_property'] ?? []),
                        'sub_property_list' => array_map($prop, array_slice($a['sub_property_list'] ?? [], 0, 4))];
                }, $c['relics']),
                'skills' => array_map(fn ($s) => Arr::only($s, ['skill_id', 'level', 'skill_type']), $c['skills']),
                'base_properties' => array_map($prop, $c['base_properties']),
                'extra_properties' => array_map($prop, $c['extra_properties']),
                'element_properties' => array_map($prop, $c['element_properties']),
            ];
        }, $data['characters']);
        $snapshot = ['characters' => $characters, 'property_map' => array_map(fn ($p) => Arr::only($p, ['name', 'property_type']), $data['property_map'])];
        return DB::transaction(function () use ($session, $data, $snapshot) {
            $locked = DB::table('build_sync_sessions')->where('id', $session->id)->lockForUpdate()->first();
            abort_if($locked->status !== 'waiting', 409);
            abort_if(now()->greaterThanOrEqualTo($locked->expires_at), 410);
            $account = GenshinAccount::whereKey($locked->genshin_account_id)->lockForUpdate()->firstOrFail();
            abort_unless($account->uid === $data['uid'], 422, 'UID HoYoLAB berbeda dari akun yang dipilih.');
            abort_if(DB::table('build_sync_sessions')->where('genshin_account_id', $account->id)
                ->where('id', '>', $locked->id)->where('status', 'completed')->exists(), 409, 'Snapshot lebih baru sudah tersimpan.');
            abort_if($account->build_synced_at && Carbon::parse($account->build_synced_at)->greaterThan($locked->created_at), 409, 'Snapshot lebih baru sudah tersimpan. Mulai sync baru.');
            $account->forceFill(['build_snapshot' => json_encode($snapshot), 'build_synced_at' => now()])->save();
            DB::table('build_sync_sessions')->where('id', $locked->id)->update(['status' => 'completed', 'message' => count($snapshot['characters']).' build karakter disimpan.', 'updated_at' => now()]);
            return response()->json(['status' => 'completed']);
        });
    }
}
