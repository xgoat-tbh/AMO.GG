# Amo.GG Assets Directory Structure

Place your custom bot assets here. The bot will automatically check this directory and load files dynamically if they are present.

```
assets/
├── logo.png          ⭐ Main Amo.GG logo
├── voice.png         🎧 Voice category
├── roles.png         🪪 Roles category
├── suggestions.png   💡 Suggestions category
├── confessions.png   💬 Confessions category
├── gameping.png      🎮 GamePing category
├── admin.png         👑 Administration category
└── utility.png       🧰 Utility category
```

---

## Emojis vs. Local Assets: How Discord Handles Them

### 1. What MUST be uploaded as Emojis in the Developer Portal / Server:
- **Status Icons** (Success, Error, Warning, Lock, Unlock, Loading, Arrow)
- **Game Emojis** (VALORANT, Minecraft, Brawlhalla, BGMI, Among Us, Monopoly, Smash Karts, Codenames)
- **Why?**: These are used **inline inside message text and descriptions** (e.g. `• <:success:id> Successfully updated`). Discord's markdown engine can only render custom inline emojis if they are registered on Discord's servers and referenced by their `<:emoji_name:emoji_id>` format. You cannot put a local file path or attachment reference inline inside text.

### 2. What CAN be stored locally on the Backend (`assets/` folder):
- **Logo (Custom)** (`logo.png`)
- **Category Icons** (`voice.png`, `roles.png`, etc.)
- **Why?**: These are used as **Section Accessories / Thumbnails** (large images shown on the right side of embeds/containers). The bot automatically reads these files from this folder, attaches them to the message payload, and references them dynamically via the `attachment://filename.png` protocol. They do not need to be uploaded to Discord.
