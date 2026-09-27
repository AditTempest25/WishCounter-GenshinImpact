<?php

use App\Http\Controllers\{AccountStatsController, SyncSessionController, WishHistoryController, ArchiveController, AuthController};
use Illuminate\Support\Facades\{Route, DB};

Route::get('/health', function () {
    DB::select('select 1');
    return response()->json(['status' => 'ok']);
})->middleware('throttle:60,1,health:');
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1,register:');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:30,1,login:');
Route::middleware(['auth:sanctum', 'throttle:180,1,authenticated:'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/password', [AuthController::class, 'password'])->middleware('throttle:5,1,password:');
    Route::get('/accounts/{uid}/archive', [ArchiveController::class, 'export']);
    Route::post('/archives/import', [ArchiveController::class, 'import'])->middleware('throttle:10,1,import:');
    Route::post('/sync-sessions', [SyncSessionController::class, 'store'])->middleware('throttle:10,1,create-sync:');
    Route::get('/sync-sessions/{token}', [SyncSessionController::class, 'show']);
    Route::get('/accounts/{uid}/stats', [AccountStatsController::class, 'show']);
    Route::get('/accounts/{uid}/wishes', [WishHistoryController::class, 'index']);
});
// The companion uses a short-lived capability token; its owner is fixed at creation.
Route::post('/sync-sessions/{token}/progress', [SyncSessionController::class, 'progress'])->middleware('throttle:60,1,progress:');
Route::post('/sync-sessions/{token}/wishes', [SyncSessionController::class, 'upload'])->middleware('throttle:10,1,upload:');
