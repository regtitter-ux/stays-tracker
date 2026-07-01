# Stays Tracker

A single-page ledger for Discord server deals.

- Paste a Discord invite link — the **server name** and **member count** are fetched automatically from Discord.
- Record the **owner**, the **buy price (stays)** and the **sell price (stays)**; profit and margin are computed for you.
- **Filter** by owner and search text, **sort** by any column (name, members, buy, sell, profit, margin, date).
- **Live refresh** re-pulls names and member counts.
- **Export / Import** your data as JSON.

## Data storage

The site is fully static, so data is stored in your browser's **localStorage** — it persists across reloads on the same browser/device. Use **Export** to back it up or move it to another device (then **Import**).

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Live name/member lookups call the public Discord invite API from your browser.
