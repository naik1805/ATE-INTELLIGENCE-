# Portable install (included in zip — copy to .env.local on setup)

Offline desktop mode is enabled by default. No cloud login required.

## Share on another PC

1. Zip the **whole project folder** plus the **`V ATE APP`** launcher folder.
2. On the new PC: run **`Setup ATE Intelligence.bat`** once (internet needed only for setup).
3. Run **`Start ATE Intelligence.bat`** every time.

Do **not** run `npm run dev` directly unless `tools/ate_frontend/.env.local` exists (created by Setup).

## If you see a cloud login error

The app tried to reach the hosted API (`wafer-yield-api.onrender.com`). Fix:

1. Run **Setup** again (writes `.env.local` with offline settings).
2. Always launch via **`Start ATE Intelligence.bat`** in `V ATE APP`.
3. Restart the app after setup.

You should see **local / ADMIN** in the header — no sign-in screen.
