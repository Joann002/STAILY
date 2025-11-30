/**
 * Script d'extraction audio avec FFmpeg
 * Convertit une vidéo en audio WAV mono 16kHz
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Extrait l'audio d'un fichier vidéo/audio
 * @param {string} inputPath - Chemin du fichier source (ex: uploads/video.mp4)
 * @returns {Promise<string>} - Chemin du fichier WAV généré
 */
function extractAudio(inputPath) {
  return new Promise((resolve, reject) => {
    // Vérifier que le fichier source existe
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Fichier source introuvable: ${inputPath}`));
    }

    // Créer le dossier tmp/ s'il n'existe pas
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
      console.log('📁 Dossier tmp/ créé');
    }

    // Générer le nom du fichier de sortie
    const inputFilename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(tmpDir, `${inputFilename}.wav`);

    console.log(`🎵 Extraction audio: ${inputPath} → ${outputPath}`);

    // Commande FFmpeg pour extraire l'audio
    // -i : fichier d'entrée
    // -vn : pas de vidéo (audio seulement)
    // -acodec pcm_s16le : codec audio PCM 16-bit little-endian
    // -ar 16000 : fréquence d'échantillonnage 16kHz
    // -ac 1 : mono (1 canal audio)
    // -y : écraser le fichier de sortie s'il existe
    const ffmpegArgs = [
      '-i', inputPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      outputPath
    ];

    // Lancer FFmpeg
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    let stderrData = '';

    // Capturer les logs FFmpeg (stderr)
    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Gestion de la fin du processus
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Audio extrait avec succès: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`❌ FFmpeg a échoué avec le code: ${code}`);
        console.error('Logs FFmpeg:', stderrData);
        reject(new Error(`FFmpeg a échoué avec le code ${code}`));
      }
    });

    // Gestion des erreurs
    ffmpeg.on('error', (err) => {
      console.error('❌ Erreur lors du lancement de FFmpeg:', err.message);
      reject(new Error(`Impossible de lancer FFmpeg: ${err.message}. Assurez-vous que FFmpeg est installé.`));
    });
  });
}

// Permettre l'utilisation en ligne de commande
if (require.main === module) {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('❌ Usage: node extractAudio.js <chemin-fichier>');
    console.error('   Exemple: node extractAudio.js uploads/video.mp4');
    process.exit(1);
  }

  extractAudio(inputPath)
    .then((outputPath) => {
      console.log(`\n✅ Succès! Fichier audio: ${outputPath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ Erreur: ${err.message}`);
      process.exit(1);
    });
}

// Export pour utilisation dans d'autres modules
module.exports = { extractAudio };
