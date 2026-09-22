# Irminsul Sync

Windows-only POC companion.

## What it does

- Requires Genshin to already be running.
- Finds the newest Genshin `webCaches/.../Cache/Cache_Data/data_2` file.
- Extracts the Wish History session URL.
- Calls HoYoverse directly from the user's PC.
- Uploads normalized wish records to the Irminsul API.
- Never uploads the cached URL/authkey.

## Run manually during development

```powershell
$env:IRMINSUL_API_BASE = "http://localhost:8000/api"
dotnet run -- --session YOUR_SYNC_TOKEN
```

For normal usage, register `irminsul://` and open the sync button from the web app.
