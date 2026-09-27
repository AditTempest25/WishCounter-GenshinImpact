<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncSession extends Model
{
    protected $fillable = [
        'user_id',
        'token_hash',
        'status',
        'uid',
        'new_wishes',
        'message',
        'expires_at',
        'completed_at',
        'summary',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'completed_at' => 'datetime',
            'summary' => 'array',
        ];
    }
}
