import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * ES module equivalent of __dirname
 */
export const __dirname = path.dirname(fileURLToPath(import.meta.url));