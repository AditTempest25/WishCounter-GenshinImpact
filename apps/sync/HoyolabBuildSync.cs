using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace IrminsulSync;

internal static class HoyolabBuildSync
{
    private const string HoyoBase = "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/";

    public static async Task RunAsync(string apiBase, string token)
    {
        using var backend = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(45) };
        try { await SyncAsync(backend, apiBase, token); }
        catch {
            try { using var result = await backend.PostAsJsonAsync($"{apiBase}/build-sync-sessions/{Uri.EscapeDataString(token)}/failed", new { }); } catch { /* Keep the original failure. */ }
            throw;
        }
    }

    private static async Task SyncAsync(HttpClient backend, string apiBase, string token)
    {
        var target = await backend.GetFromJsonAsync<JsonObject>($"{apiBase}/build-sync-sessions/{Uri.EscapeDataString(token)}/target");
        var uid = target?["uid"]?.GetValue<string>() ?? throw new InvalidOperationException("Build session is not available. Start a new session from the website.");
        Console.WriteLine("Open the HoYoLAB window, log in, then choose Sync this account.");
        string cookie = await LoginAsync(uid);
        // Separate HTTP clients ensure the cookie never reaches Irminsul or a redirected host.
        using var hoyo = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false }) { Timeout = TimeSpan.FromSeconds(30) };
        hoyo.DefaultRequestHeaders.Add("Cookie", cookie);
        hoyo.DefaultRequestHeaders.Add("Referer", "https://www.hoyolab.com/");
        hoyo.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 IrminsulWish/1.1");
        hoyo.DefaultRequestHeaders.Add("x-rpc-app_version", "1.5.0");
        hoyo.DefaultRequestHeaders.Add("x-rpc-client_type", "5");
        hoyo.DefaultRequestHeaders.Add("x-rpc-language", "en-us");
        hoyo.DefaultRequestHeaders.Add("x-rpc-lang", "en-us");
        var roles = await RequestAsync(hoyo, "https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_global", null);
        var role = (roles["list"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(r => r["game_uid"]?.ToString() == uid);
        if (role is null) throw new InvalidOperationException("This HoYoLAB login does not own the selected Genshin UID. Start again and log in to the correct account.");
        string server = role["region"]?.ToString() ?? throw new InvalidOperationException("Genshin region is unavailable.");
        if (!new[] { "os_asia", "os_usa", "os_euro", "os_cht" }.Contains(server)) throw new InvalidOperationException("Only global HoYoLAB accounts are supported.");
        var roster = await RequestAsync(hoyo, HoyoBase + "character/list", new JsonObject { ["role_id"] = uid, ["server"] = server });
        var ids = (roster["list"] as JsonArray)?.OfType<JsonObject>().Select(c => c["id"]!.GetValue<int>()).Distinct().ToArray() ?? [];
        if (ids.Length is 0 or > 200) throw new InvalidOperationException("Character roster is empty or unsupported. Check Battle Chronicle in HoYoLAB.");
        var characters = new JsonArray();
        var map = new JsonObject();
        foreach (var batch in ids.Chunk(10))
        {
            Console.WriteLine($"Reading character builds: {characters.Count}/{ids.Length}...");
            var detail = await RequestAsync(hoyo, HoyoBase + "character/detail", new JsonObject {
                ["role_id"] = uid, ["server"] = server, ["character_ids"] = new JsonArray(batch.Select(id => JsonValue.Create(id)).ToArray())
            });
            var list = detail["list"] as JsonArray ?? throw new InvalidOperationException("Character details are unavailable. Open My Characters in HoYoLAB, then retry.");
            var returned = list.OfType<JsonObject>().Select(c => c["base"]?["id"]?.GetValue<int>() ?? 0).Order().ToArray();
            if (!returned.SequenceEqual(batch.Order())) throw new InvalidOperationException("HoYoLAB returned incomplete details. The previous snapshot was kept; retry later.");
            foreach (var c in list) characters.Add(ProjectCharacter(c!.AsObject()));
            if (detail["property_map"] is JsonObject properties)
                foreach (var (key, info) in properties) map[key] = Project(info?.AsObject(), "name", "property_type");
            await Task.Delay(500);
        }
        Console.WriteLine($"Uploading {characters.Count} builds. HoYoLAB cookies stay on this PC.");
        using var response = await backend.PostAsJsonAsync($"{apiBase}/build-sync-sessions/{Uri.EscapeDataString(token)}/builds", new JsonObject {
            ["uid"] = uid, ["characters"] = characters, ["property_map"] = map
        });
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Irminsul rejected the build snapshot ({(int)response.StatusCode}). Start a new sync if the session expired.");
    }

    private static async Task<JsonObject> RequestAsync(HttpClient http, string url, JsonObject? body)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var random = new string(Enumerable.Range(0, 6).Select(_ => (char)('a' + RandomNumberGenerator.GetInt32(26))).ToArray());
        var hash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes($"salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t={timestamp}&r={random}"))).ToLowerInvariant();
        using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, url);
        request.Headers.Add("DS", $"{timestamp},{random},{hash}");
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"HoYoLAB is unavailable (HTTP {(int)response.StatusCode}). Retry later.");
        var json = await response.Content.ReadFromJsonAsync<JsonObject>() ?? throw new InvalidOperationException("HoYoLAB returned invalid data.");
        int code = json["retcode"]?.GetValue<int>() ?? -1;
        if (code != 0) throw new InvalidOperationException(code switch {
            -100 or 10001 => "HoYoLAB login expired. Start a new build sync and log in again.",
            10035 or 5003 or 10041 or 1034 => "HoYoLAB requires verification. Complete it yourself in HoYoLAB Battle Chronicle, then retry.",
            10102 => "Battle Chronicle data is unavailable. Open My Characters in HoYoLAB and check the account settings.",
            _ => $"HoYoLAB rejected the request (code {code}). Open Battle Chronicle and retry later."
        });
        return json["data"]?.AsObject() ?? throw new InvalidOperationException("HoYoLAB returned no character data.");
    }

    internal static JsonObject Project(JsonObject? source, params string[] keys)
    {
        var result = new JsonObject();
        if (source is not null) foreach (var key in keys) if (source[key] is JsonValue value) result[key] = value.DeepClone();
        return result;
    }
    internal static JsonObject ProjectProperty(JsonNode? p) => Project(p as JsonObject, "property_type", "base", "add", "final", "value");
    private static string Icon(JsonNode? value)
    {
        var input = value?.ToString() ?? "";
        var name = Uri.TryCreate(input, UriKind.Absolute, out var uri) ? Path.GetFileNameWithoutExtension(uri.AbsolutePath) : input;
        return System.Text.RegularExpressions.Regex.IsMatch(name, "^(UI_|Skill_)[A-Za-z0-9_]+$") ? name : "";
    }
    internal static JsonObject ProjectCharacter(JsonObject c)
    {
        var result = new JsonObject { ["base"] = Project(c["base"] as JsonObject, "id", "level", "actived_constellation_num", "fetter", "element") };
        var weapon = Project(c["weapon"] as JsonObject, "id", "name", "level", "rarity", "affix_level");
        weapon["icon"] = Icon(c["weapon"]?["icon"]);
        weapon["main_property"] = ProjectProperty(c["weapon"]?["main_property"]);
        weapon["sub_property"] = ProjectProperty(c["weapon"]?["sub_property"]);
        result["weapon"] = weapon;
        var relics = new JsonArray();
        foreach (var a in (c["relics"] as JsonArray ?? [])) {
            var item = Project(a as JsonObject, "id", "name", "level", "rarity", "pos");
            item["icon"] = Icon(a?["icon"]);
            item["set"] = Project(a?["set"] as JsonObject, "name");
            item["main_property"] = ProjectProperty(a?["main_property"]);
            item["sub_property_list"] = new JsonArray((a?["sub_property_list"] as JsonArray ?? []).Take(4).Select(p => (JsonNode)ProjectProperty(p)).ToArray());
            relics.Add(item);
        }
        result["relics"] = relics;
        result["skills"] = new JsonArray((c["skills"] as JsonArray ?? []).Select(s => (JsonNode)Project(s as JsonObject, "skill_id", "level", "skill_type")).ToArray());
        foreach (var group in new[] { "base_properties", "extra_properties", "element_properties" })
            result[group] = new JsonArray((c[group] as JsonArray ?? []).Select(p => (JsonNode)ProjectProperty(p)).ToArray());
        return result;
    }

    private static Task<string> LoginAsync(string uid)
    {
        var completion = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() => {
            Application.EnableVisualStyles();
            using var form = new Form { Text = "HoYoLAB login · Irminsul Sync", Width = 1100, Height = 820 };
            using var browser = new WebView2 { Dock = DockStyle.Fill };
            using var panel = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 65, Padding = new Padding(10) };
            using var notice = new Label { Text = $"Log in directly to HoYoLAB. Target UID: {uid}. Only character builds are uploaded.", AutoSize = true, MaximumSize = new Size(690, 0) };
            using var confirm = new Button { Text = "Sync this account", AutoSize = true, Enabled = false };
            panel.Controls.Add(notice); panel.Controls.Add(confirm); form.Controls.Add(browser); form.Controls.Add(panel);
            form.Shown += async (_, _) => {
                try {
                    var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "IrminsulWish", "HoYoLABWebView");
                    var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: folder);
                    var options = environment.CreateCoreWebView2ControllerOptions();
                    options.IsInPrivateModeEnabled = true; options.ProfileName = "HoYoLABBuildSync";
                    await browser.EnsureCoreWebView2Async(environment, options);
                    browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    browser.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
                    browser.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
                    browser.CoreWebView2.NewWindowRequested += (_, e) => { e.Handled = true; if (Trusted(e.Uri)) browser.CoreWebView2.Navigate(e.Uri); };
                    browser.CoreWebView2.NavigationStarting += (_, e) => { if (!Trusted(e.Uri)) e.Cancel = true; };
                    browser.CoreWebView2.Navigate("https://www.hoyolab.com/"); confirm.Enabled = true;
                } catch { completion.TrySetException(new InvalidOperationException("HoYoLAB login window could not start. Install Microsoft Edge WebView2 Runtime, then retry.")); form.Close(); }
            };
            confirm.Click += async (_, _) => {
                confirm.Enabled = false;
                try {
                    var cookies = await browser.CoreWebView2.CookieManager.GetCookiesAsync("https://www.hoyolab.com/");
                    var allowed = new[] { "ltoken", "ltuid", "ltoken_v2", "ltuid_v2", "ltmid_v2" };
                    var selected = cookies.Where(c => allowed.Contains(c.Name)).ToArray();
                    if (!selected.Any(c => c.Name is "ltoken" or "ltoken_v2") || !selected.Any(c => c.Name is "ltuid" or "ltuid_v2")) {
                        MessageBox.Show(form, "Log in to HoYoLAB first, then press Sync this account."); confirm.Enabled = true; return;
                    }
                    completion.TrySetResult(string.Join("; ", selected.Select(c => $"{c.Name}={c.Value}"))); form.Close();
                } catch { completion.TrySetException(new InvalidOperationException("HoYoLAB login could not be read. Retry the login window.")); form.Close(); }
            };
            form.FormClosed += (_, _) => completion.TrySetCanceled();
            Application.Run(form);
        });
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); return completion.Task;
    }
    private static bool Trusted(string url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        new[] { "hoyolab.com", "hoyoverse.com", "mihoyo.com" }.Any(domain => uri.Host == domain || uri.Host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase));
}
