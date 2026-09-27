<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\GenshinAccount;
use App\Models\SyncSession;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AssignLegacyArchive extends Command
{
    protected $signature = 'irminsul:assign-legacy {email} {uid}';
    protected $description = 'Assign an unowned local archive to an explicitly selected registered user';
    public function handle(): int
    {
        $user = User::where('email', mb_strtolower($this->argument('email')))->first();
        if (!$user) { $this->error('Register this email first.'); return self::FAILURE; }
        $uid = $this->argument('uid');
        if (GenshinAccount::where('uid', $uid)->where('user_id', $user->id)->exists()) {
            $this->error('This user already has that UID. No data was changed.'); return self::FAILURE;
        }
        $count = DB::transaction(function () use ($uid, $user) {
            $count = GenshinAccount::where('uid', $uid)->whereNull('user_id')->update(['user_id' => $user->id]);
            if ($count) SyncSession::where('uid', $uid)->whereNull('user_id')->update(['user_id' => $user->id]);
            return $count;
        });
        if (!$count) { $this->error('No unowned archive found.'); return self::FAILURE; }
        $this->info('Legacy archive assigned. Refresh the signed-in dashboard.');
        return self::SUCCESS;
    }
}
