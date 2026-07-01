# Stays DB

A directory of Discord servers and the price each one **buys** or **sells** stays at.

- Paste a Discord invite link — the **server name** and **member count** are fetched automatically from Discord.
- Record the **owner**, the server's **buy price** and **sell price** for stays.
- Prices use the format `$price:amount` (e.g. `$1:10` = $1 for 10 stays). A dash `-` means no data (the server doesn't buy or doesn't sell). The per‑stay rate (`$/stay`) is shown under each price.
- **Filter** by owner and search text; **sort** by name, members, owner, buy price or sell price.
- **Live refresh** re-pulls names and member counts.
- **Export / Import** the whole directory as JSON.

## Data storage

The site is fully static, so data is stored in your browser's **localStorage** — it persists across reloads on the same browser/device. Use **Export** to back it up or move it to another device (then **Import**).

> For a shared online database (many people seeing the same directory from any device) a backend is needed — this can be added with a free hosted DB.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Live name/member lookups call the public Discord invite API from your browser.
