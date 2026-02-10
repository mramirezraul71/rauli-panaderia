// Force deploy script for Vercel
const { execSync } = require('child_process');

console.log('🚀 Forzando deploy automático...');

try {
  // Create a visible change
  const timestamp = new Date().toISOString();
  console.log('⏰ Timestamp:', timestamp);
  
  // Update version with timestamp
  const versionData = {
    version: "2026.02.09",
    build: timestamp,
    force: true
  };
  
  require('fs').writeFileSync(
    'public/version.json', 
    JSON.stringify(versionData, null, 2)
  );
  
  // Add and commit
  execSync('git add public/version.json', { stdio: 'inherit' });
  execSync(`git commit -m "force: Auto-sync deploy ${timestamp}"`, { stdio: 'inherit' });
  execSync('git push origin maestro', { stdio: 'inherit' });
  
  console.log('✅ Deploy forzado completado');
} catch (error) {
  console.error('❌ Error:', error.message);
}
