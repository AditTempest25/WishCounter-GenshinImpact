<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\SyncSession;
use App\Models\GenshinAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate(['name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => $this->passwordRules()]);
        return DB::transaction(fn () => $this->session(User::create($data), 201));
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:254'], 'password' => ['required', 'string', 'max:128']]);
        $email = mb_strtolower(trim($data['email']));
        $key = 'login:'.hash('sha256', $email.'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 5)) return response()->json(['message' => 'Terlalu banyak percobaan. Coba lagi dalam satu menit.'], 429);
        $user = User::where('email', $email)->first();
        if (!$user || !Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => 'Email atau password salah.']);
        }
        RateLimiter::clear($key);
        return $this->session($user);
    }

    private function session(User $user, int $status = 200)
    {
        return response()->json(['user' => $user->only('id', 'name', 'email'),
            'token' => $user->createToken('web-session', ['*'], now()->addDays(7))->plainTextToken], $status);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()->only('id', 'name', 'email'),
            'accounts' => GenshinAccount::where('user_id', $request->user()->id)->orderBy('uid')->get(['uid', 'region'])]);
    }

    public function logout(Request $request)
    {
        $this->cancelPending($request->user()->id);
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['message' => 'Signed out.']);
    }

    public function password(Request $request)
    {
        $data = $request->validate(['current_password' => ['required', 'string'], 'password' => $this->passwordRules()]);
        if (!Hash::check($data['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages(['current_password' => 'Password saat ini salah.']);
        }
        DB::transaction(function () use ($request, $data) {
            $request->user()->update(['password' => $data['password']]);
            $request->user()->tokens()->delete();
            $this->cancelPending($request->user()->id);
        });
        return response()->json(['message' => 'Password diubah. Silakan login kembali.']);
    }

    private function cancelPending(int $userId): void
    {
        SyncSession::where('user_id', $userId)->whereIn('status', ['waiting', 'syncing'])
            ->update(['status' => 'failed', 'message' => 'Sesi login berakhir. Login dan mulai sync baru.']);
        DB::table('build_sync_sessions')->whereIn('genshin_account_id', GenshinAccount::where('user_id', $userId)->select('id'))
            ->where('status', 'waiting')->update(['status' => 'failed', 'message' => 'Sesi login berakhir. Login dan mulai sync baru.', 'updated_at' => now()]);
    }

    private function passwordRules(): array
    {
        return ['required', 'string', 'min:12', 'confirmed', function ($attribute, $value, $fail) {
            if (strlen($value) > 72) $fail('Password maksimal 72 byte.');
        }];
    }
}
