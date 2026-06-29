export const promotionConfig = {
  shorteners: [
    'bit.ly', 'tinyurl.com', 'shorturl.at', 'short.link', 'rb.gy',
    'cutt.ly', 'ow.ly', 'is.gd', 'buff.ly', 'tiny.cc', 'bl.ink',
    '2.gp', 'cli.gs', 'zip.net', 'tr.im', 'v.gd', 'clicky.me',
    'shorte.st', 'bc.vc', 'adf.ly', 'shrinke.me', 'u.nu',
  ],

  socialDomains: [
    'youtube.com', 'youtu.be', 'twitch.tv', 'kick.com', 'rumble.com',
    'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'snapchat.com',
    'facebook.com', 'fb.com', 'discord.com', 'discord.gg', 'discord.me',
    'telegram.org', 't.me', 'whatsapp.com', 'wa.me', 'reddit.com',
    'patreon.com', 'ko-fi.com', 'buymeacoffee.com', 'subscribestar.com',
  ],

  bypassPatterns: [
    /\bd\s*i\s*s\s*c\s*o\s*r\s*d\b/i,
    /\bdiscord\s*\.?\s*(gg|com|me)\b/i,
    /discord[\s_-]*app/i,
    /(?:https?|http)[\s]*[:]?\s*[\/]+\s*/i,
    /\[.*?\]\(.*?\)/,
    /(?:dot|dawg|at)\s*(?:com|gg|me|io)\b/i,
  ],
};
