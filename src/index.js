import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config } from './config/bot.config.js';
import { logger } from './helpers/logger.js';
import { getDb, closeDb } from './database/connection.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ConfigRepo } from './database/repositories/config.repo.js';
import { BlacklistRepo } from './database/repositories/blacklist.repo.js';
import { permConfig } from './config/permissions.config.js';
import { assets } from './config/assets.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  allowedMentions: { parse: ['users'] },
});

// ── Collections ──────────────────────────────────────────────
client.commands = new Collection();
client.aliases = new Collection();
client.buttons = new Collection();
client.selects = new Collection();
client.modals = new Collection();

// ── Load Commands ────────────────────────────────────────────
async function loadCommands() {
  client.commands.clear();
  client.aliases.clear();
  const commandsPath = join(__dirname, 'commands');
  const categories = readdirSync(commandsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const files = readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = join(categoryPath, file);
      const fileUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
      const command = await import(fileUrl);
      const cmd = command.default || command;

      if (!cmd.name) {
        logger.warn('LOADER', `Command ${file} is missing a name, skipping`);
        continue;
      }

      cmd.category = category;
      client.commands.set(cmd.name, cmd);

      if (cmd.aliases?.length) {
        for (const alias of cmd.aliases) {
          client.aliases.set(alias, cmd.name);
        }
      }

      logger.debug('LOADER', `Loaded command: ${cmd.name} [${category}]`);
    }
  }
  logger.info('LOADER', `Loaded ${client.commands.size} commands`);
}

// ── Load Components ──────────────────────────────────────────
async function loadComponents() {
  client.buttons.clear();
  client.selects.clear();
  client.modals.clear();
  const componentsPath = join(__dirname, 'components');
  const types = [
    { dir: 'buttons', collection: client.buttons },
    { dir: 'selects', collection: client.selects },
    { dir: 'modals', collection: client.modals },
  ];

  for (const { dir, collection } of types) {
    const dirPath = join(componentsPath, dir);
    let files;
    try {
      files = readdirSync(dirPath).filter(f => f.endsWith('.js'));
    } catch {
      continue; // Directory may not exist yet
    }

    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
      const component = await import(fileUrl);
      const comp = component.default || component;

      if (!comp.customId) {
        logger.warn('LOADER', `Component ${file} is missing customId, skipping`);
        continue;
      }

      collection.set(comp.customId, comp);
      logger.debug('LOADER', `Loaded ${dir}: ${comp.customId}`);
    }
  }
}

// ── Load Events ──────────────────────────────────────────────
async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const files = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  // Remove old event listeners registered by this loader
  if (!client.eventListeners) {
    client.eventListeners = new Map();
  }
  for (const [evtName, listeners] of client.eventListeners.entries()) {
    for (const listener of listeners) {
      client.off(evtName, listener);
    }
  }
  client.eventListeners.clear();

  for (const file of files) {
    const filePath = join(eventsPath, file);
    const fileUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
    const event = await import(fileUrl);
    const evt = event.default || event;

    const listener = (...args) => evt.execute(...args, client);
    if (evt.once) {
      client.once(evt.name, listener);
    } else {
      client.on(evt.name, listener);
    }

    if (!client.eventListeners.has(evt.name)) {
      client.eventListeners.set(evt.name, []);
    }
    client.eventListeners.get(evt.name).push(listener);

    logger.debug('LOADER', `Loaded event: ${evt.name}`);
  }
}

// ── Bootstrap ────────────────────────────────────────────────
async function start() {
  logger.info('BOT', `Starting ${config.branding.name}...`);

  // Initialize database
  const db = getDb();

  // Cache configuration and blacklist in memory
  client.maintenanceMode = ConfigRepo.get(db, 'maintenance_mode') === 'true';
  client.blacklist = new Set(BlacklistRepo.getAll(db));

  // Expose loader methods on client for hot-reloads
  client.loadCommands = loadCommands;
  client.loadComponents = loadComponents;
  client.loadEvents = loadEvents;

  // Load all modules
  await loadCommands();
  await loadComponents();
  await loadEvents();

  // Login
  await client.login(config.token);
}

// ── Graceful Shutdown ────────────────────────────────────────
function shutdown(signal) {
  logger.info('BOT', `Received ${signal}. Shutting down...`);
  closeDb();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  logger.error('BOT', 'Unhandled rejection', error);
});
process.on('uncaughtException', (error) => {
  logger.error('BOT', 'Uncaught exception', error);
});

export async function reloadConfig() {
  const newConfigModule = await import(`./config/bot.config.js?update=${Date.now()}`);
  const newConfig = newConfigModule.config;
  for (const key of Object.keys(config)) {
    delete config[key];
  }
  Object.assign(config, newConfig);

  const newAssetsModule = await import(`./config/assets.config.js?update=${Date.now()}`);
  const newAssets = newAssetsModule.assets;
  for (const key of Object.keys(assets)) {
    delete assets[key];
  }
  Object.assign(assets, newAssets);

  const newPermModule = await import(`./config/permissions.config.js?update=${Date.now()}`);
  const newPerm = newPermModule.permConfig;
  for (const key of Object.keys(permConfig)) {
    delete permConfig[key];
  }
  Object.assign(permConfig, newPerm);
}

start().catch(error => {
  logger.error('BOT', 'Failed to start', error);
  process.exit(1);
});
