<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wishes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('genshin_account_id')->constrained()->cascadeOnDelete();
            $table->string('wish_id', 32);
            $table->string('gacha_type', 8);
            $table->string('uigf_gacha_type', 8)->index();
            $table->string('item_id')->nullable();
            $table->string('item_name');
            $table->string('item_type');
            $table->unsignedTinyInteger('rank_type');
            $table->string('wish_time', 19);
            $table->timestamps();

            $table->unique(['genshin_account_id', 'wish_id']);
            $table->index(['genshin_account_id', 'uigf_gacha_type', 'wish_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wishes');
    }
};
