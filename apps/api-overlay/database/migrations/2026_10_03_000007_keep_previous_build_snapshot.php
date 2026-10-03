<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('genshin_accounts', function (Blueprint $table) {
            $table->json('previous_build_snapshot')->nullable();
            $table->timestamp('previous_build_synced_at')->nullable();
        });
    }
    public function down(): void
    {
        Schema::table('genshin_accounts', fn (Blueprint $table) => $table->dropColumn(['previous_build_snapshot', 'previous_build_synced_at']));
    }
};
