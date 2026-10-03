namespace IrminsulSync;

internal sealed record SyncLaunch(string Token, bool IsBuild)
{
    public static SyncLaunch? Parse(string[] args)
    {
        foreach (var arg in args)
        {
            if (!arg.StartsWith("irminsul:", StringComparison.OrdinalIgnoreCase)) continue;
            if (!Uri.TryCreate(arg, UriKind.Absolute, out var uri) || uri.Scheme != "irminsul" ||
                uri.UserInfo.Length > 0 || !uri.IsDefaultPort || uri.Fragment.Length > 0 ||
                (uri.AbsolutePath != "" && uri.AbsolutePath != "/"))
                throw new InvalidOperationException("Invalid Irminsul link. Start a new sync from the website.");
            var isBuild = uri.Host.Equals("builds", StringComparison.OrdinalIgnoreCase);
            if (!isBuild && !uri.Host.Equals("sync", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Unknown sync action. Start a new sync from the website.");
            var query = QueryString.Parse(uri.Query);
            if (!query.TryGetValue("session", out var token) || !ValidToken(token))
                throw new InvalidOperationException("Invalid sync session. Start a new sync from the website.");
            return new SyncLaunch(token, isBuild);
        }
        for (var i = 0; i < args.Length - 1; i++)
            if (args[i].Equals("--session", StringComparison.OrdinalIgnoreCase) && ValidToken(args[i + 1]))
                return new SyncLaunch(args[i + 1], false);
        return null;
    }

    private static bool ValidToken(string token) => token.Length == 64 && token.All(char.IsAsciiLetterOrDigit);

    public static int Verify()
    {
        var token = new string('a', 64);
        foreach (var link in new[] { $"irminsul://builds?session={token}", $"irminsul://builds/?session={token}", $"IRMINSUL://BUILDS/?session={token}" })
            if (Parse([link]) is not { IsBuild: true } request || request.Token != token) throw new Exception("Build dispatch failed.");
        foreach (var link in new[] { $"irminsul://sync?session={token}", $"irminsul://sync/?session={token}" })
            if (Parse([link]) is not { IsBuild: false }) throw new Exception("Wish dispatch failed.");
        foreach (var link in new[] { $"irminsul://unknown/?session={token}", $"irminsul://builds/other?session={token}", "irminsul://builds/?session=bad" })
        {
            try { Parse([link]); } catch (InvalidOperationException) { continue; }
            throw new Exception("Invalid link was accepted.");
        }
        Console.WriteLine("Protocol checks passed: build and wish routes, browser slash normalization, invalid actions and sessions.");
        return 0;
    }
}
