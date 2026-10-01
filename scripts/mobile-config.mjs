// Native builds call the API directly (the web build proxies /api on its own origin).
import { writeFileSync } from 'node:fs';

const apiUrl = process.env.FLOWLY_API_URL || 'https://api.flowly.net/api';
writeFileSync('dist/flowly-frontend/browser/config.json', JSON.stringify({ apiUrl }, null, 2) + '\n');
console.log(`config.json → ${apiUrl}`);
