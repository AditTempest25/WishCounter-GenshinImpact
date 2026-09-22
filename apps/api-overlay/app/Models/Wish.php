<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Wish extends Model
{
    protected $fillable = [
        'genshin_account_id',
        'wish_id',
        'gacha_type',
        'uigf_gacha_type',
        'item_id',
        'item_name',
        'item_type',
        'rank_type',
        'wish_time',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(GenshinAccount::class, 'genshin_account_id');
    }
}
