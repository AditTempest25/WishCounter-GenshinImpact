using System.Diagnostics;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace IrminsulSync;

internal static class Program
{
    private const string DefaultApiBase = "http://localhost:8000/api";
    private static readonly HttpClient Http = new()
    {
        Timeout = TimeSpan.FromSeconds(30),
    };
    private static readonly HttpClient UploadHttp = new()
    {
        // Importing a full account can take longer than one upstream history page.
        Timeout = TimeSpan.FromMinutes(2),
    };

    public static async Task<int> Main(string[] args)
    {
        Console.Title = "Irminsul Sync";
        Console.WriteLine("Irminsul Sync POC v0.1");
        Console.WriteLine("-----------------------");

        try
        {
            var sessionToken = GetSessionToken(args);
            if (string.IsNullOrWhiteSpace(sessionToken))
            {
                Console.Error.WriteLine("Missing sync session. Launch this app from the Irminsul Wish web dashboard.");
                return 2;
            }

            if (!IsGenshinRunning())
            {
                Console.Error.WriteLine("Genshin Impact is not running. Launch it through HoYoPlay first, then retry sync.");
                KeepErrorVisible();
                return 3;
            }

            Console.WriteLine("Genshin detected.");
            Console.WriteLine("Looking for a fresh Wish History session...");

            var cachedWishUrl = WishUrlExtractor.FindLatestWishUrl();
            if (cachedWishUrl is null)
            {
                Console.Error.WriteLine("No Wish History URL found. In Genshin, open Wish -> History and wait for it to load, then press Start Sync again.");
                KeepErrorVisible();
                return 4;
            }

            Console.WriteLine("Wish History session found locally.");
            Console.WriteLine("Fetching wish records directly from HoYoverse...");

            var fetcher = new HoyoWishFetcher(Http, cachedWishUrl);
            var result = await fetcher.FetchAllAsync();

            if (result.Wishes.Count == 0)
            {
                Console.WriteLine("No wish records returned. The session may be fresh but the account currently has no visible records.");
            }
            else
            {
                Console.WriteLine($"Fetched {result.Wishes.Count} records locally for UID {result.Uid ?? "unknown"}.");
            }

            var apiBase = (Environment.GetEnvironmentVariable("IRMINSUL_API_BASE") ?? DefaultApiBase).TrimEnd('/');
            var endpoint = $"{apiBase}/sync-sessions/{Uri.EscapeDataString(sessionToken)}/wishes";

            // Deliberately upload normalized wish data only. cachedWishUrl/authkey never leaves this process.
            var payload = new UploadPayload(
                Source: "windows-companion",
                Uid: result.Uid,
                Region: result.Region,
                Wishes: result.Wishes
            );

            using var uploadResponse = await UploadHttp.PostAsJsonAsync(endpoint, payload, JsonDefaults.Options);
            var uploadBody = await uploadResponse.Content.ReadAsStringAsync();
            if (!uploadResponse.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Irminsul API rejected sync ({(int)uploadResponse.StatusCode}): {uploadBody}");
            }

            Console.WriteLine("Sync completed. You can return to the web dashboard.");
            await Task.Delay(1200);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine($"Sync failed: {ex.Message}");
            KeepErrorVisible();
            return 1;
        }
    }

    private static bool IsGenshinRunning()
    {
        string[] names = ["GenshinImpact", "YuanShen"];
        return names.Any(name => Process.GetProcessesByName(name).Length > 0);
    }

    private static string? GetSessionToken(string[] args)
    {
        foreach (var arg in args)
        {
            if (arg.StartsWith("irminsul://", StringComparison.OrdinalIgnoreCase))
            {
                var uri = new Uri(arg);
                var query = QueryString.Parse(uri.Query);
                return query.GetValueOrDefault("session");
            }
        }

        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals("--session", StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        }

        return null;
    }

    private static void KeepErrorVisible()
    {
        if (!Console.IsInputRedirected)
        {
            Console.WriteLine("Press Enter to close.");
            Console.ReadLine();
        }
    }
}

internal static class WishUrlExtractor
{
    private static readonly Regex GameDataPathRegex = new(
        @"[A-Za-z]:[/\\].*?(?:GenshinImpact_Data|YuanShen_Data)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex WishUrlRegex = new(
        @"https://[^\x00-\x20""']+?game_biz=hk4e_(?:global|cn)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string? FindLatestWishUrl()
    {
        var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var candidates = new[]
        {
            Path.Combine(profile, "AppData", "LocalLow", "miHoYo", "Genshin Impact", "output_log.txt"),
            Path.Combine(profile, "AppData", "LocalLow", "miHoYo", "原神", "output_log.txt"),
        };

        var logPath = candidates
            .Where(File.Exists)
            .Select(path => new FileInfo(path))
            .OrderByDescending(info => info.LastWriteTimeUtc)
            .Select(info => info.FullName)
            .FirstOrDefault();

        if (logPath is null) return null;

        var logContent = ReadSharedText(logPath, Encoding.UTF8);
        var gameDataMatches = GameDataPathRegex.Matches(logContent);
        if (gameDataMatches.Count == 0) return null;

        var gameDataPath = gameDataMatches[^1].Value.Replace('/', Path.DirectorySeparatorChar);
        var webCaches = Path.Combine(gameDataPath, "webCaches");
        if (!Directory.Exists(webCaches)) return null;

        var cacheRoots = Directory.GetDirectories(webCaches)
            .Select(path => new DirectoryInfo(path))
            .OrderByDescending(info => info.LastWriteTimeUtc);

        foreach (var cacheRoot in cacheRoots)
        {
            var data2 = Path.Combine(cacheRoot.FullName, "Cache", "Cache_Data", "data_2");
            if (!File.Exists(data2)) continue;

            // Cache is binary-ish; Latin1 preserves bytes 1:1 and URL bytes remain searchable.
            var content = ReadSharedText(data2, Encoding.Latin1);
            var matches = WishUrlRegex.Matches(content);
            if (matches.Count == 0) continue;

            return matches[^1].Value;
        }

        return null;
    }

    private static string ReadSharedText(string path, Encoding encoding)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream, encoding);
        return reader.ReadToEnd();
    }
}

internal sealed class HoyoWishFetcher(HttpClient http, string cachedWishUrl)
{
    private static readonly string[] GachaTypes = ["100", "200", "301", "400", "302", "500"];

    public async Task<FetchResult> FetchAllAsync()
    {
        var deduped = new Dictionary<string, NormalizedWish>(StringComparer.Ordinal);
        string? uid = null;
        string? region = null;

        foreach (var type in GachaTypes)
        {
            await Task.Delay(1000);
            string endId = "0";
            var page = 1;

            while (true)
            {
                var url = BuildApiUrl(cachedWishUrl, type, page, endId);
                var api = await FetchPageAsync(url);

                if (api.Retcode != 0)
                    throw new InvalidOperationException($"HoYoverse API error {api.Retcode}: {api.Message}");

                region ??= api.Data?.Region;
                var list = api.Data?.List ?? [];
                if (list.Count == 0) break;

                foreach (var wish in list)
                {
                    if (string.IsNullOrWhiteSpace(wish.Id)) continue;
                    uid ??= wish.Uid;
                    deduped[wish.Id] = new NormalizedWish(
                        Id: wish.Id,
                        GachaType: wish.GachaType ?? type,
                        UigfGachaType: ToUigfType(wish.GachaType ?? type),
                        ItemId: wish.ItemId,
                        Name: wish.Name ?? "Unknown",
                        ItemType: wish.ItemType ?? "Unknown",
                        RankType: wish.RankType ?? "0",
                        Time: wish.Time ?? ""
                    );
                }

                endId = list[^1].Id ?? "0";
                if (endId == "0") break;
                page++;

                // Avoid hammering the upstream API while walking history pages.
                await Task.Delay(1000);
            }
        }

        var ordered = deduped.Values
            .OrderBy(w => w.Time, StringComparer.Ordinal)
            .ThenBy(w => w.Id, StringComparer.Ordinal)
            .ToList();

        return new FetchResult(uid, region, ordered);
    }

    private async Task<HoyoResponse> FetchPageAsync(string url)
    {
        for (var attempt = 0; ; attempt++)
        {
            using var response = await http.GetAsync(url);
            HoyoResponse? api = null;
            if (response.StatusCode != System.Net.HttpStatusCode.TooManyRequests)
            {
                response.EnsureSuccessStatusCode();
                api = await response.Content.ReadFromJsonAsync<HoyoResponse>(JsonDefaults.Options)
                    ?? throw new InvalidOperationException("HoYoverse returned an empty response.");
                if (api.Retcode != -110) return api;
            }

            if (attempt >= 3)
                throw new InvalidOperationException("HoYoverse is rate limiting requests. Wait a few minutes, then retry sync.");

            var delaySeconds = 5 * (1 << attempt);
            Console.WriteLine($"HoYoverse requested a slower sync. Retrying in {delaySeconds} seconds...");
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
    }

    private static string BuildApiUrl(string cachedUrl, string gachaType, int page, string endId)
    {
        var source = new Uri(cachedUrl);
        var isChina = cachedUrl.Contains("game_biz=hk4e_cn", StringComparison.OrdinalIgnoreCase);
        var apiBase = isChina
            ? "https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog"
            : "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog";

        var preserved = source.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Where(pair =>
            {
                var key = pair.Split('=', 2)[0];
                return !key.Equals("gacha_type", StringComparison.OrdinalIgnoreCase)
                       && !key.Equals("page", StringComparison.OrdinalIgnoreCase)
                       && !key.Equals("size", StringComparison.OrdinalIgnoreCase)
                       && !key.Equals("end_id", StringComparison.OrdinalIgnoreCase);
            })
            .ToList();

        preserved.Add($"gacha_type={Uri.EscapeDataString(gachaType)}");
        preserved.Add($"page={page}");
        preserved.Add("size=20");
        preserved.Add($"end_id={Uri.EscapeDataString(endId)}");

        return $"{apiBase}?{string.Join('&', preserved)}";
    }

    private static string ToUigfType(string gachaType) => gachaType == "400" ? "301" : gachaType;
}

internal static class QueryString
{
    public static Dictionary<string, string> Parse(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0]);
            var value = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : "";
            result[key] = value;
        }
        return result;
    }
}

internal static class JsonDefaults
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
}

internal sealed record UploadPayload(
    string Source,
    string? Uid,
    string? Region,
    IReadOnlyList<NormalizedWish> Wishes);

internal sealed record FetchResult(string? Uid, string? Region, IReadOnlyList<NormalizedWish> Wishes);

internal sealed record NormalizedWish(
    string Id,
    string GachaType,
    string UigfGachaType,
    string? ItemId,
    string Name,
    string ItemType,
    string RankType,
    string Time);

internal sealed class HoyoResponse
{
    public int Retcode { get; set; }
    public string? Message { get; set; }
    public HoyoData? Data { get; set; }
}

internal sealed class HoyoData
{
    public List<HoyoWish>? List { get; set; }
    public string? Region { get; set; }
}

internal sealed class HoyoWish
{
    public string? Uid { get; set; }
    public string? Id { get; set; }

    [JsonPropertyName("gacha_type")]
    public string? GachaType { get; set; }

    [JsonPropertyName("item_id")]
    public string? ItemId { get; set; }

    public string? Name { get; set; }

    [JsonPropertyName("item_type")]
    public string? ItemType { get; set; }

    [JsonPropertyName("rank_type")]
    public string? RankType { get; set; }

    public string? Time { get; set; }
}
