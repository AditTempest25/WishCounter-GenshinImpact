<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id(); $table->morphs('tokenable'); $table->text('name');
            $table->string('token', 64)->unique(); $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable(); $table->timestamp('expires_at')->nullable()->index(); $table->timestamps();
        });
        Schema::table('genshin_accounts', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $table->dropUnique(['uid']);
            $table->unique(['user_id', 'uid']);
        });
        Schema::table('sync_sessions', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
        });
        // Legacy data remains quarantined until the local administrator explicitly assigns it.
        DB::table('sync_sessions')->whereIn('status', ['waiting', 'syncing'])->update(['status' => 'failed', 'message' => 'Please sign in and start a new sync.']);
    }
    public function down(): void
    {
        // Refuse a lossy rollback when distinct owners have the same game UID.
        if (DB::table('genshin_accounts')->select('uid')->groupBy('uid')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new RuntimeException('Cannot remove ownership while duplicate UIDs exist across owners. Restore a backup instead.');
        }
        Schema::table('sync_sessions', fn (Blueprint $table) => $table->dropConstrainedForeignId('user_id'));
        Schema::table('genshin_accounts', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'uid']); $table->dropConstrainedForeignId('user_id'); $table->unique('uid');
        });
        Schema::dropIfExists('personal_access_tokens');
    }
};
