<?php

namespace App\Http\Controllers;

use App\Models\GenshinAccount;
use App\Models\Wish;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ArchiveController extends Controller
{
    public function export(string $uid)
    {
        $account = GenshinAccount::where('user_id', auth()->id())->where('uid', $uid)->firstOrFail();
        return response()->json([
            'format' => 'irminsul-archive', 'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'account' => ['uid' => $account->uid, 'region' => $account->region],
            'wishes' => $account->wishes()->orderBy('wish_time')->orderBy('wish_id')->get()->map(fn ($wish) => [
                'id' => $wish->wish_id, 'gacha_type' => $wish->gacha_type,
                'item_id' => $wish->item_id, 'name' => $wish->item_name,
                'item_type' => $wish->item_type, 'rank_type' => (string) $wish->rank_type,
                'time' => $wish->wish_time,
            ]),
        ])->header('Cache-Control', 'no-store');
    }

    public function import(Request $request)
    {
        $data = $request->validate([
            'format' => ['required', 'in:irminsul-archive'], 'version' => ['required', 'integer', 'in:1'],
            'account' => ['required', 'array:uid,region'],
            'account.uid' => ['required', 'string', 'regex:/^[0-9]{6,20}$/'],
            'account.region' => ['nullable', 'string', 'max:32'],
            'wishes' => ['present', 'array', 'max:50000'],
            'wishes.*' => ['required', 'array:id,gacha_type,item_id,name,item_type,rank_type,time'],
            'wishes.*.id' => ['required', 'string', 'regex:/^[0-9]{1,32}$/', 'distinct:strict'],
            'wishes.*.gacha_type' => ['required', 'string', 'in:100,200,301,400,302,500'],
            'wishes.*.item_id' => ['nullable', 'string', 'max:64'],
            'wishes.*.name' => ['required', 'string', 'max:255'],
            'wishes.*.item_type' => ['required', 'string', 'max:64'],
            'wishes.*.rank_type' => ['required', 'string', 'in:1,2,3,4,5'],
            'wishes.*.time' => ['required', 'date_format:Y-m-d H:i:s'],
        ]);
        $result = DB::transaction(function () use ($data) {
            $account = GenshinAccount::firstOrCreate(['user_id' => auth()->id(), 'uid' => $data['account']['uid']], ['region' => $data['account']['region'] ?? null]);
            $added = 0;
            foreach ($data['wishes'] as $row) {
                $values = ['gacha_type' => $row['gacha_type'],
                    'uigf_gacha_type' => $row['gacha_type'] === '400' ? '301' : $row['gacha_type'],
                    'item_id' => $row['item_id'] ?? null, 'item_name' => $row['name'],
                    'item_type' => $row['item_type'], 'rank_type' => (int) $row['rank_type'], 'wish_time' => $row['time']];
                $wish = Wish::firstOrCreate(['genshin_account_id' => $account->id, 'wish_id' => $row['id']], $values);
                if ($wish->wasRecentlyCreated) { $added++; continue; }
                // Names may differ by language, but conflicting wish identity must not be silently ignored.
                foreach (['gacha_type', 'rank_type', 'wish_time'] as $field) {
                    if ((string) $wish->$field !== (string) $values[$field]) {
                        throw ValidationException::withMessages(['wishes' => 'ID wish bertabrakan dengan data lama. Impor dibatalkan seluruhnya.']);
                    }
                }
                if ($wish->item_id && $values['item_id'] && $wish->item_id !== $values['item_id']) {
                    throw ValidationException::withMessages(['wishes' => 'Item pada ID wish berbeda. Impor dibatalkan seluruhnya.']);
                }
            }
            return ['uid' => $account->uid, 'added' => $added, 'duplicates' => count($data['wishes']) - $added];
        });
        return response()->json($result);
    }
}
