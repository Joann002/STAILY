/**
 * Script Node.js pour appeler la transcription Python (faster-whisper)
 * Utilise child_process pour exécuter le script Python et récupérer le JSON
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Transcrit un fichier audio avec faster-whisper (Python)
 * @param {string} audioPath - Chemin du fichier audio WAV (ex: tmp/audio.wav)
 * @param {string} modelSize - Taille du modèle (tiny, base, small, medium, large-v3)
 * @param {string} language - Code langue (fr, en, etc.) ou null pour auto-détection
 * @returns {Promise<object>} - Résultat de transcription avec segments
 */
function transcribeAudio(audioPath, modelSize = 'large-v3', language = null) {
  return new Promise((resolve, reject) => {
    // Vérifier que le fichier audio existe
    if (!fs.existsSync(audioPath)) {
      return reject(new Error(`Fichier audio introuvable: ${audioPath}`));
    }

    // Chemins
    const pythonScript = path.join(__dirname, '../whisper/transcribe.py');
    const venvPython = path.join(__dirname, '../venv/bin/python');
    
    // Vérifier que le script Python existe
    if (!fs.existsSync(pythonScript)) {
      return reject(new Error(`Script Python introuvable: ${pythonScript}`));
    }

    // Vérifier que l'environnement virtuel existe
    if (!fs.existsSync(venvPython)) {
      return reject(new Error(
        `Environnement virtuel Python introuvable. ` +
        `Exécutez: cd backend && python3 -m venv venv && source venv/bin/activate && pip install faster-whisper`
      ));
    }

    // Construire les arguments (gère automatiquement les espaces)
    const args = [pythonScript, audioPath, modelSize];
    if (language) {
      args.push(language);
    }

    console.log(`🎤 Transcription en cours: ${audioPath}`);
    console.log(`   Modèle: ${modelSize}, Langue: ${language || 'auto'}`);

    // Exécuter le script Python avec execFile (gère les espaces automatiquement)
    execFile(venvPython, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Afficher les logs Python (stderr)
      if (stderr) {
        console.log(stderr);
      }

      if (error) {
        console.error(`❌ Erreur transcription: ${error.message}`);
        return reject(new Error(`Échec de la transcription: ${error.message}`));
      }

      try {
        // Parser le JSON retourné par Python
        const result = JSON.parse(stdout);
        
        console.log(`✅ Transcription terminée: ${result.segments.length} segments`);
        console.log(`   Langue: ${result.language} (${(result.language_probability * 100).toFixed(1)}%)`);
        console.log(`   Durée: ${result.duration}s`);

        // Chemin du fichier JSON sauvegardé
        const jsonPath = audioPath.replace(/\.[^.]+$/, '.json');
        result.jsonPath = jsonPath;

        resolve(result);
      } catch (parseError) {
        console.error(`❌ Erreur parsing JSON: ${parseError.message}`);
        console.error(`Sortie Python: ${stdout}`);
        reject(new Error(`Impossible de parser le résultat: ${parseError.message}`));
      }
    });
  });
}

/**
 * Lit le fichier JSON de transcription
 * @param {string} jsonPath - Chemin du fichier JSON
 * @returns {Promise<object>} - Contenu du JSON
 */
function readTranscriptionJSON(jsonPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(jsonPath, 'utf8', (err, data) => {
      if (err) {
        return reject(new Error(`Impossible de lire ${jsonPath}: ${err.message}`));
      }
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (parseError) {
        reject(new Error(`JSON invalide: ${parseError.message}`));
      }
    });
  });
}

// Permettre l'utilisation en ligne de commande
if (require.main === module) {
  const audioPath = process.argv[2];
  const modelSize = process.argv[3] || 'large-v3';
  const language = process.argv[4] || null;

  if (!audioPath) {
    console.error('❌ Usage: node transcribeAudio.js <audio.wav> [model_size] [language]');
    console.error('   Exemple: node transcribeAudio.js tmp/audio.wav base fr');
    console.error('   Modèles: tiny, base, small, medium, large-v3');
    process.exit(1);
  }

  transcribeAudio(audioPath, modelSize, language)
    .then((result) => {
      console.log('\n📄 Résultat:');
      console.log(JSON.stringify(result, null, 2));
      console.log(`\n💾 JSON sauvegardé: ${result.jsonPath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ Erreur: ${err.message}`);
      process.exit(1);
    });
}

// Export pour utilisation dans d'autres modules
module.exports = { transcribeAudio, readTranscriptionJSON };
