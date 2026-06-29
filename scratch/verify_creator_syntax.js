import { getConfig } from '../src/helpers/configHelper.js';
import { logCreatorSetup } from '../src/services/loggingService.js';
import helpCmd from '../src/commands/utility/help.js';
import creatorCmd from '../src/commands/creator/creator.js';

console.log('✅ Config Helper resolved:', typeof getConfig);
console.log('✅ Logging Service logCreatorSetup resolved:', typeof logCreatorSetup);
console.log('✅ Help Command resolved:', helpCmd.name);
console.log('✅ Creator Command resolved:', creatorCmd.name);
console.log('🎉 Verification passed! All files loaded without import/syntax errors.');
