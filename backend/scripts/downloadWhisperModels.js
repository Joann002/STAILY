/**
 * Script Node.js pour pré-télécharger tous les modèles Whisper
 * Wrapper autour du script Python
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODELS = [
  { name: 'tiny', size: '~75 MB' },
  { name: 'base', size: '~145 MB' },
  { name: 'small', size: '~466 MB' },
  { name: 'medium', size: '~1.5 GB' },
  { name: 'large-v3', size: '~3 GB' }
];

async function downloadAllModels() {
  console.log('🎤 PRÉ-TÉLÉCHARGEMENT DES MODÈLES WHISPER');
  console.log('='.repeat(60));
  console.log('Les modèles seront téléchargés dans:');
  console.log('~/.cache/huggingface/hub/');
  console.log('\nModèles à télécharger:');
  
  MODELS.forEach(model => {
    console.log(`  • ${model.name.padEnd(10)} ${model.size}`);
  });
  
  console.log('\nTotal: ~5.2 GB');
  console.log('='.repeat(60));

  // Chemins
  const pythonScript = path.join(__dirname, 'downloadWhisperModels.py');
  const venvPython = path.join(__dirname, '../venv/bin/python');

  // Vérifications
  if (!fs.existsSync(pythonScript)) {
    console.error('❌ Script Python introuvable:', pythonScript);
    process.exit(1);
  }

  if (!fs.existsSync(venvPython)) {
    console.error('❌ Environnement virtuel Python introuvable');
    console.error('Exécutez: cd backend && python3 -m venv venv && source venv/bin/activate && pip install faster-whisper');
    process.exit(1);
  }

  // Lancer le script Python
  console.log('\n🚀 Lancement du téléchargement...\n');

  const python = spawn(venvPython, [pythonScript, '--yes'], {
    stdio: 'inherit'
  });

  python.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Téléchargement terminé avec succès!');
      console.log('💡 Vous pouvez maintenant utiliser Whisper hors ligne');
    } else {
      console.error(`\n❌ Erreur lors du téléchargement (code: ${code})`);
      process.exit(code);
    }
  });

  python.on('error', (err) => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  });
}

// Exécution
if (require.main === module) {
  downloadAllModels();
}

module.exports = { downloadAllModels };
