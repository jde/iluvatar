// Writes the starter score to scores/storefront-ambient/score.yaml so the shared copy never drifts from the code.
import { writeFileSync } from 'node:fs';
import { defaultScore, scoreToYaml } from '../src/core/score';
writeFileSync('scores/storefront-ambient/score.yaml', scoreToYaml(defaultScore()));
console.log('wrote scores/storefront-ambient/score.yaml');
