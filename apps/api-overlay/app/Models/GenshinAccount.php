<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GenshinAccount extends Model
{
    protected $fillable = ['uid', 'region'];

    public function wishes(): HasMany
    {
        return $this->hasMany(Wish::class);
    }
}
