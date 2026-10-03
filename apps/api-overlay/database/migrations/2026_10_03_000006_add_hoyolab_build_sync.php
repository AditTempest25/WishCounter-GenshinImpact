<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('genshin_accounts', function (Blueprint $table) {
            $table->json('build_snapshot')->nullable();
            $table->timestamp('build_synced_at')->nullable();
        });
        Schema::create('build_sync_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('genshin_account_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->string('status', 16)->default('waiting');
            $table->string('message')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('build_sync_sessions');
        Schema::table('genshin_accounts', fn (Blueprint $table) => $table->dropColumn(['build_snapshot', 'build_synced_at']));
    }
};
