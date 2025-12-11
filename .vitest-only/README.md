# Why This Directory Exists

This project uses **Vitest** for testing, not Buntest.

If you see this message, you probably ran `bun test` by mistake.

## ✅ Correct Command

```bash
bun run test
```

## ❌ Wrong Command

```bash
bun test  # This won't work - we use Vitest, not Buntest
```

## Why?

- `bun test` runs Buntest (Bun's native test runner)
- `bun run test` runs Vitest (configured in vitest.config.mts)

We've fully migrated to Vitest for better ecosystem support, mature tooling, and our
PGlite database mocking setup.

The `bunfig.toml` file points Buntest to this empty directory to fail fast if someone
tries to run `bun test` accidentally.
