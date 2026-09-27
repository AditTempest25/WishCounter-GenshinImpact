<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sync_sessions', fn (Blueprint $table) => $table->json('summary')->nullable());
    }

    public function down(): void
    {
        Schema::table('sync_sessions', fn (Blueprint $table) => $table->dropColumn('summary'));
    }
};
