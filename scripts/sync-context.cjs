const fs = require('fs');

const header = "<!-- ⚠️ AUTO-GENERADO desde CLAUDE.md. NO editar a mano — editá CLAUDE.md y corré sync-context. -->\n";
const claudeContent = fs.readFileSync('CLAUDE.md', 'utf8');

fs.writeFileSync('GEMINI.md', header + claudeContent);
console.log("Sincronización completada.");
