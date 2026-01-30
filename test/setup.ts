/**
 * Test setup - loads environment variables from .env.local
 * This file is preloaded before all tests via bunfig.toml
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dir, "../.env.local");

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("="); // Handle values with = in them

    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  }

  console.log("✓ Loaded environment from .env.local");
} else {
  console.warn("⚠ .env.local not found, tests may fail");
}
