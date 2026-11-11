import { ruhrgebietPack } from './content/regions/ruhrgebiet';
import { log } from './core/log';
import { createGame } from './game/game';

// Placeholder entry point; replaced by the real composition root (world + ui).
const game = createGame(ruhrgebietPack);
log.info(`BuedchenSim started: ${game.content.name} (${game.state.regionId})`);
