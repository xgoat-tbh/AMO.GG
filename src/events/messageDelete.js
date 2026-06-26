import { addDeletedMessage } from '../systems/snipe/snipeManager.js';

export default {
  name: 'messageDelete',
  once: false,

  execute(message) {
    try {
      addDeletedMessage(message);
    } catch (err) {
      // Fail silently to prevent event listener crashes
    }
  },
};
