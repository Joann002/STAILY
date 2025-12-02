/**
 * Module d'amélioration audio avec FFmpeg
 * Applique des filtres pour nettoyer et améliorer la qualité audio
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Paramètres d'amélioration audio recommandés
 */
const ENHANCEMENT_PRESETS = {
  // Amélioration légère (audio déjà correct)
  LIGHT: {
    normalize: true,
    volumeGain: 0,
    highpass: 200,
    lowpass: null,
    noiseReduction: false,
    compressor: false
  },
  
  // Amélioration standard (audio moyen)
  STANDARD: {
    normalize: true,
    volumeGain: 5,
    highpass: 200,
    lowpass: 3000,
    noiseReduction: true,
    compressor: true
  },
  
  // Amélioration agressive (audio très mauvais)
  AGGRESSIVE: {
    normalize: true,
    volumeGain: 10,
    highpass: 300,
    lowpass: 3000,
    noiseReduction: true,
    compressor: true,
    denoiseStrength: 0.1
  }
};

/**
 * Construit la chaîne de filtres FFmpeg
 * @param {Object} options - Options d'amélioration
 * @returns {string} Chaîne de filtres FFmpeg
 */
function buildFilterChain(options) {
  const filters = [];

  // Filtre passe-haut (élimine les basses fréquences parasites)
  if (options.highpass) {
    filters.push(`highpass=f=${options.highpass}`);
  }

  // Filtre passe-bas (élimine les hautes fréquences parasites)
  if (options.lowpass) {
    filters.push(`lowpass=f=${options.lowpass}`);
  }

  // Réduction de bruit (afftdn = FFT Denoiser)
  if (options.noiseReduction) {
    const strength = options.denoiseStrength || 0.05;
    filters.push(`afftdn=nf=${strength}`);
  }

  // Augmentation du volume
  if (options.volumeGain && options.volumeGain !== 0) {
    filters.push(`volume=${options.volumeGain}dB`);
  }

  // Normalisation du volume
  if (options.normalize) {
    // loudnorm normalise selon les standards de diffusion
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }

  // Compresseur dynamique (réduit la plage dynamique)
  if (options.compressor) {
    filters.push('acompressor=threshold=-20dB:ratio=4:attack=200:release=1000');
  }

  return filters.join(',');
}

/**
 * Améliore un fichier audio avec FFmpeg
 * @param {string} inputPath - Chemin du fichier audio source
 * @param {string} outputPath - Chemin du fichier audio amélioré (optionnel)
 * @param {Object|string} options - Options d'amélioration ou nom de preset
 * @returns {Promise<string>} Chemin du fichier amélioré
 */
function enhanceAudio(inputPath, outputPath = null, options = 'STANDARD') {
  return new Promise((resolve, reject) => {
    // Si options est une string, utiliser le preset
    const enhancementOptions = typeof options === 'string' 
      ? ENHANCEMENT_PRESETS[options] || ENHANCEMENT_PRESETS.STANDARD
      : options;

    // Générer le chemin de sortie si non fourni
    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      outputPath = path.join(dir, `${basename}_enhanced${ext}`);
    }

    // Construire la chaîne de filtres
    const filterChain = buildFilterChain(enhancementOptions);

    console.log(`\n🔧 Amélioration audio en cours...`);
    console.log(`   📁 Source: ${path.basename(inputPath)}`);
    console.log(`   📁 Sortie: ${path.basename(outputPath)}`);
    console.log(`   🎛️  Filtres: ${filterChain}`);

    // Arguments FFmpeg
    const args = [
      '-i', inputPath,
      '-af', filterChain,
      '-ar', '16000',  // Sample rate optimal pour Whisper
      '-ac', '1',      // Mono (Whisper préfère le mono)
      '-y',            // Overwrite
      outputPath
    ];

    const startTime = Date.now();

    execFile('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`   ❌ Erreur FFmpeg: ${error.message}`);
        return reject(new Error(`Échec de l'amélioration audio: ${error.message}`));
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Vérifier que le fichier a été créé
      if (!fs.existsSync(outputPath)) {
        return reject(new Error('Fichier amélioré non créé'));
      }

      const inputSize = fs.statSync(inputPath).size;
      const outputSize = fs.statSync(outputPath).size;

      console.log(`   ✅ Amélioration terminée en ${duration}s`);
      console.log(`   📊 Taille: ${(inputSize / 1024 / 1024).toFixed(2)}MB → ${(outputSize / 1024 / 1024).toFixed(2)}MB`);

      resolve(outputPath);
    });
  });
}

/**
 * Supprime les segments silencieux d'un audio
 * @param {string} inputPath - Chemin du fichier audio source
 * @param {string} outputPath - Chemin du fichier audio sans silences (optionnel)
 * @param {number} silenceThreshold - Seuil de silence en dB (défaut: -50)
 * @param {number} minSilenceDuration - Durée minimum d'un silence à supprimer (défaut: 0.5s)
 * @returns {Promise<string>} Chemin du fichier sans silences
 */
function removeSilence(inputPath, outputPath = null, silenceThreshold = -50, minSilenceDuration = 0.5) {
  return new Promise((resolve, reject) => {
    // Générer le chemin de sortie si non fourni
    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      outputPath = path.join(dir, `${basename}_nosilence${ext}`);
    }

    console.log(`\n✂️  Suppression des silences...`);
    console.log(`   📁 Source: ${path.basename(inputPath)}`);
    console.log(`   🔇 Seuil: ${silenceThreshold}dB, Durée min: ${minSilenceDuration}s`);

    // Utilise le filtre silenceremove de FFmpeg
    const args = [
      '-i', inputPath,
      '-af', `silenceremove=start_periods=1:start_duration=${minSilenceDuration}:start_threshold=${silenceThreshold}dB:detection=peak,silenceremove=stop_periods=-1:stop_duration=${minSilenceDuration}:stop_threshold=${silenceThreshold}dB:detection=peak`,
      '-y',
      outputPath
    ];

    execFile('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`   ❌ Erreur FFmpeg: ${error.message}`);
        return reject(new Error(`Échec de la suppression des silences: ${error.message}`));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('Fichier sans silences non créé'));
      }

      console.log(`   ✅ Silences supprimés: ${path.basename(outputPath)}`);
      resolve(outputPath);
    });
  });
}

/**
 * Applique une amélioration automatique basée sur le rapport de qualité
 * @param {string} inputPath - Chemin du fichier audio source
 * @param {Object} qualityReport - Rapport de qualité audio
 * @param {string} outputPath - Chemin du fichier audio amélioré (optionnel)
 * @returns {Promise<Object>} {enhancedPath, preset, appliedFilters}
 */
async function autoEnhance(inputPath, qualityReport, outputPath = null) {
  console.log(`\n🤖 Amélioration automatique basée sur l'analyse...`);

  // Déterminer le preset à utiliser
  let preset = 'STANDARD';
  const issues = qualityReport.issues || [];

  const hasCriticalIssues = issues.some(i => i.severity === 'CRITICAL');
  const hasHighIssues = issues.some(i => i.severity === 'HIGH');

  if (hasCriticalIssues || qualityReport.qualityScore < 30) {
    preset = 'AGGRESSIVE';
    console.log(`   🔴 Qualité critique détectée → Preset AGGRESSIVE`);
  } else if (hasHighIssues || qualityReport.qualityScore < 60) {
    preset = 'STANDARD';
    console.log(`   🟡 Qualité moyenne détectée → Preset STANDARD`);
  } else {
    preset = 'LIGHT';
    console.log(`   🟢 Qualité acceptable détectée → Preset LIGHT`);
  }

  // Appliquer l'amélioration
  const enhancedPath = await enhanceAudio(inputPath, outputPath, preset);

  // Supprimer les silences si nécessaire
  let finalPath = enhancedPath;
  if (qualityReport.silence && qualityReport.silence.silencePercent > 50) {
    console.log(`   ✂️  Silence excessif détecté (${qualityReport.silence.silencePercent.toFixed(1)}%), suppression...`);
    try {
      finalPath = await removeSilence(enhancedPath);
      // Supprimer le fichier intermédiaire
      if (finalPath !== enhancedPath && fs.existsSync(enhancedPath)) {
        fs.unlinkSync(enhancedPath);
      }
    } catch (silenceError) {
      console.warn(`   ⚠️  Impossible de supprimer les silences: ${silenceError.message}`);
      finalPath = enhancedPath;
    }
  }

  return {
    enhancedPath: finalPath,
    preset,
    appliedFilters: buildFilterChain(ENHANCEMENT_PRESETS[preset]),
    originalQualityScore: qualityReport.qualityScore
  };
}

module.exports = {
  enhanceAudio,
  removeSilence,
  autoEnhance,
  buildFilterChain,
  ENHANCEMENT_PRESETS
};
