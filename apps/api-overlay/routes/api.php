<?php

use App\Http\Controllers\AccountStatsController;
use App\Http\Controllers\SyncSessionController;
use Illuminate\Support\Facades\Route;

Route::post('/sync-sessions', [SyncSessionController::class, 'store']);
Route::get('/sync-sessions/{token}', [SyncSessionController::class, 'show']);
Route::post('/sync-sessions/{token}/wishes', [SyncSessionController::class, 'upload']);
Route::get('/accounts/{uid}/stats', [AccountStatsController::class, 'show']);
