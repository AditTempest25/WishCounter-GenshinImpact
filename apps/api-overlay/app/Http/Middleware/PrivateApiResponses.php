<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class PrivateApiResponses
{
    public function handle(Request $request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');
        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');
        return $response;
    }
}
