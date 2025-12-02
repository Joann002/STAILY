/**
 * Script pour vérifier quels modèles Whisper sont déjà téléchargés
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MODELS = [
  { name: 'tiny', size: '~75 MB' },
  { name: 'base', size: '~145 MB' },
  { name: 'small', size: '~466 MB' },
  { name: 'medium', size: '~1.5 GB' },
  { name: 'large-v3', size: '~3 GB' }
];

function checkModelCache() {
  console.log('🔍 VÉRIFICATION DES MODÈLES WHISPER');
  console.log('='.repeat(60));

  const cacheDir = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  
  console.log(`📁 Répertoire de cache: ${cacheDir}\n`);

  if (!fs.existsSync(cacheDir)) {
    console.log('❌ Aucun modèle téléchargé');
    console.log('\n💡 Pour télécharger tous les modèles:');
    console.log('   node scripts/downloadWhisperModels.js');
    return;
  }

  try {
    const files = fs.readdirSync(cacheDir);
    const whisperModels = files.filter(f => f.includes('whisper'));

    if (whisperModels.length === 0) {
      console.log('❌ Aucun modèle Whisper trouvé');
      console.log('\n💡 Pour télécharger tous les modèles:');
      console.log('   node scripts/downloadWhisperModels.js');
      return;
    }

    console.log('📦 Modèles détectés:\n');

    MODELS.forEach(model => {
      const found = whisperModels.some(f => 
        f.toLowerCase().includes(model.name.replace('-', ''))
      );
      
      const status = found ? '✅' : '❌';
      const statusText = found ? 'Téléchargé' : 'Non téléchargé';
      
      console.log(`${status} ${model.name.padEnd(10)} ${model.size.padEnd(10)} ${statusText}`);
    });

    const downloadedCount = MODELS.filter(model => 
      whisperModels.some(f => f.toLowerCase().includes(model.name.replace('-', '')))
    ).length;

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${downloadedCount}/${MODELS.length} modèles téléchargés`);

    if (downloadedCount < MODELS.length) {
      console.log('\n💡 Pour télécharger les modèles manquants:');
      console.log('   node scripts/downloadWhisperModels.js');
    } else {
      console.log('\n🎉 Tous les modèles sont disponibles pour une utilisation hors ligne!');
    }

    // Afficher la taille totale du cache
    let totalSize = 0;
    whisperModels.forEach(modelDir => {
      const modelPath = path.join(cacheDir, modelDir);
      try {
        const stats = fs.statSync(modelPath);
        if (stats.isDirectory()) {
          // Calculer la taille du dossier (approximatif)
          const files = fs.readdirSync(modelPath);
          files.forEach(file => {
            const filePath = path.join(modelPath, file);
            try {
              const fileStats = fs.statSync(filePath);
              totalSize += fileStats.size;
            } catch (e) {}
          });
        }
      } catch (e) {}
    });

    if (totalSize > 0) {
      const sizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(0);
      console.log(`💾 Espace utilisé: ${sizeGB} GB (${sizeMB} MB)`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

// Exécution
if (require.main === module) {
  checkModelCache();
}

module.exports = { checkModelCache };
