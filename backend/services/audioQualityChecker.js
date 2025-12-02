/**
 * Module de détection automatique de qualité audio
 * Analyse le volume, le silence, et les caractéristiques spectrales
 */

const { execFile } = require('child_process');
const path = require('path');

/**
 * Seuils recommandés pour la détection de qualité audio
 */
const QUALITY_THRESHOLDS = {
  // Volume moyen minimum acceptable (en dB)
  MIN_MEAN_VOLUME: -40,
  
  // Volume maximum minimum (évite les audios complètement silencieux)
  MIN_MAX_VOLUME: -20,
  
  // Pourcentage maximum de silence acceptable
  MAX_SILENCE_PERCENT: 80,
  
  // Durée minimum d'audio non-silencieux (en secondes)
  MIN_NON_SILENCE_DURATION: 2,
  
  // Seuil de détection de silence (en dB)
  SILENCE_THRESHOLD: -50,
  
  // Durée minimum d'un segment de silence (en secondes)
  SILENCE_MIN_DURATION: 0.5
};

/**
 * Analyse le volume et les caractéristiques audio avec FFmpeg
 * @param {string} audioPath - Chemin du fichier audio
 * @returns {Promise<Object>} Statistiques audio
 */
function analyzeAudioVolume(audioPath) {
  return new Promise((resolve, reject) => {
    // Utilise le filtre volumedetect de FFmpeg
    const args = [
      '-i', audioPath,
      '-af', 'volumedetect',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // FFmpeg écrit les stats dans stderr
      if (error && !stderr.includes('volumedetect')) {
        return reject(new Error(`Erreur FFmpeg: ${error.message}`));
      }

      try {
        // Parser les résultats de volumedetect
        const meanVolumeMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
        const maxVolumeMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
        const histogramMatch = stderr.match(/histogram_(\d+)db:\s*(\d+)/g);

        const stats = {
          meanVolume: meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : null,
          maxVolume: maxVolumeMatch ? parseFloat(maxVolumeMatch[1]) : null,
          histogram: {}
        };

        // Parser l'histogramme
        if (histogramMatch) {
          histogramMatch.forEach(match => {
            const [, db, count] = match.match(/histogram_(\d+)db:\s*(\d+)/);
            stats.histogram[db] = parseInt(count);
          });
        }

        resolve(stats);
      } catch (parseError) {
        reject(new Error(`Impossible de parser les stats audio: ${parseError.message}`));
      }
    });
  });
}

/**
 * Détecte les segments de silence dans l'audio
 * @param {string} audioPath - Chemin du fichier audio
 * @param {number} silenceThreshold - Seuil de silence en dB (défaut: -50)
 * @param {number} minDuration - Durée minimum d'un silence en secondes (défaut: 0.5)
 * @returns {Promise<Object>} Statistiques de silence
 */
function analyzeSilence(audioPath, silenceThreshold = -50, minDuration = 0.5) {
  return new Promise((resolve, reject) => {
    // Utilise le filtre silencedetect de FFmpeg
    const args = [
      '-i', audioPath,
      '-af', `silencedetect=noise=${silenceThreshold}dB:d=${minDuration}`,
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stderr.includes('silencedetect')) {
        return reject(new Error(`Erreur FFmpeg: ${error.message}`));
      }

      try {
        // Parser les segments de silence
        const silenceStarts = [];
        const silenceEnds = [];
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        
        // Extraire la durée totale
        let totalDuration = 0;
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          totalDuration = hours * 3600 + minutes * 60 + seconds;
        }

        // Extraire les timestamps de silence
        const startMatches = stderr.matchAll(/silence_start:\s*([\d.]+)/g);
        const endMatches = stderr.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g);

        for (const match of startMatches) {
          silenceStarts.push(parseFloat(match[1]));
        }

        for (const match of endMatches) {
          silenceEnds.push({
            end: parseFloat(match[1]),
            duration: parseFloat(match[2])
          });
        }

        // Calculer les statistiques
        const totalSilenceDuration = silenceEnds.reduce((sum, s) => sum + s.duration, 0);
        const silencePercent = totalDuration > 0 ? (totalSilenceDuration / totalDuration) * 100 : 0;
        const nonSilenceDuration = totalDuration - totalSilenceDuration;

        resolve({
          totalDuration,
          totalSilenceDuration,
          nonSilenceDuration,
          silencePercent,
          silenceSegments: silenceEnds.length,
          silenceStarts,
          silenceEnds
        });
      } catch (parseError) {
        reject(new Error(`Impossible de parser les stats de silence: ${parseError.message}`));
      }
    });
  });
}

/**
 * Évalue la qualité globale de l'audio
 * @param {string} audioPath - Chemin du fichier audio
 * @returns {Promise<Object>} Rapport de qualité complet
 */
async function checkAudioQuality(audioPath) {
  console.log(`\n🔍 Analyse de qualité audio: ${path.basename(audioPath)}`);
  
  try {
    // Analyser le volume
    console.log('   📊 Analyse du volume...');
    const volumeStats = await analyzeAudioVolume(audioPath);
    
    // Analyser le silence
    console.log('   🔇 Analyse du silence...');
    const silenceStats = await analyzeSilence(
      audioPath,
      QUALITY_THRESHOLDS.SILENCE_THRESHOLD,
      QUALITY_THRESHOLDS.SILENCE_MIN_DURATION
    );

    // Évaluer les problèmes
    const issues = [];
    let qualityScore = 100;

    // Vérifier le volume moyen
    if (volumeStats.meanVolume !== null && volumeStats.meanVolume < QUALITY_THRESHOLDS.MIN_MEAN_VOLUME) {
      issues.push({
        type: 'LOW_VOLUME',
        severity: 'HIGH',
        message: `Volume moyen trop bas: ${volumeStats.meanVolume.toFixed(1)}dB (minimum: ${QUALITY_THRESHOLDS.MIN_MEAN_VOLUME}dB)`,
        value: volumeStats.meanVolume,
        threshold: QUALITY_THRESHOLDS.MIN_MEAN_VOLUME
      });
      qualityScore -= 30;
    }

    // Vérifier le volume maximum
    if (volumeStats.maxVolume !== null && volumeStats.maxVolume < QUALITY_THRESHOLDS.MIN_MAX_VOLUME) {
      issues.push({
        type: 'VERY_LOW_VOLUME',
        severity: 'CRITICAL',
        message: `Volume maximum trop bas: ${volumeStats.maxVolume.toFixed(1)}dB (minimum: ${QUALITY_THRESHOLDS.MIN_MAX_VOLUME}dB)`,
        value: volumeStats.maxVolume,
        threshold: QUALITY_THRESHOLDS.MIN_MAX_VOLUME
      });
      qualityScore -= 40;
    }

    // Vérifier le pourcentage de silence
    if (silenceStats.silencePercent > QUALITY_THRESHOLDS.MAX_SILENCE_PERCENT) {
      issues.push({
        type: 'TOO_MUCH_SILENCE',
        severity: 'HIGH',
        message: `Trop de silence: ${silenceStats.silencePercent.toFixed(1)}% (maximum: ${QUALITY_THRESHOLDS.MAX_SILENCE_PERCENT}%)`,
        value: silenceStats.silencePercent,
        threshold: QUALITY_THRESHOLDS.MAX_SILENCE_PERCENT
      });
      qualityScore -= 25;
    }

    // Vérifier la durée de contenu non-silencieux
    if (silenceStats.nonSilenceDuration < QUALITY_THRESHOLDS.MIN_NON_SILENCE_DURATION) {
      issues.push({
        type: 'INSUFFICIENT_CONTENT',
        severity: 'CRITICAL',
        message: `Contenu audio insuffisant: ${silenceStats.nonSilenceDuration.toFixed(1)}s (minimum: ${QUALITY_THRESHOLDS.MIN_NON_SILENCE_DURATION}s)`,
        value: silenceStats.nonSilenceDuration,
        threshold: QUALITY_THRESHOLDS.MIN_NON_SILENCE_DURATION
      });
      qualityScore -= 50;
    }

    // Déterminer le niveau de qualité
    let qualityLevel;
    if (qualityScore >= 80) {
      qualityLevel = 'GOOD';
    } else if (qualityScore >= 50) {
      qualityLevel = 'ACCEPTABLE';
    } else if (qualityScore >= 30) {
      qualityLevel = 'POOR';
    } else {
      qualityLevel = 'UNUSABLE';
    }

    const report = {
      qualityLevel,
      qualityScore: Math.max(0, qualityScore),
      isAcceptable: qualityScore >= 50,
      needsEnhancement: qualityScore < 80,
      volume: volumeStats,
      silence: silenceStats,
      issues,
      recommendations: generateRecommendations(issues)
    };

    // Afficher le résumé
    console.log(`\n   📈 Résultat: ${qualityLevel} (score: ${report.qualityScore}/100)`);
    if (issues.length > 0) {
      console.log(`   ⚠️  ${issues.length} problème(s) détecté(s):`);
      issues.forEach(issue => {
        console.log(`      - ${issue.message}`);
      });
    } else {
      console.log(`   ✅ Aucun problème détecté`);
    }

    return report;

  } catch (error) {
    console.error(`   ❌ Erreur analyse: ${error.message}`);
    throw error;
  }
}

/**
 * Génère des recommandations basées sur les problèmes détectés
 * @param {Array<Object>} issues - Liste des problèmes
 * @returns {Array<string>} Recommandations
 */
function generateRecommendations(issues) {
  const recommendations = [];

  issues.forEach(issue => {
    switch (issue.type) {
      case 'LOW_VOLUME':
      case 'VERY_LOW_VOLUME':
        recommendations.push('Appliquer une normalisation du volume');
        recommendations.push('Augmenter le gain audio');
        break;
      case 'TOO_MUCH_SILENCE':
        recommendations.push('Supprimer les segments silencieux');
        break;
      case 'INSUFFICIENT_CONTENT':
        recommendations.push('Vérifier que le fichier contient bien du contenu audio');
        recommendations.push('Utiliser un modèle Whisper plus robuste (medium/large)');
        break;
    }
  });

  // Recommandations générales pour audio de mauvaise qualité
  if (issues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
    recommendations.push('Appliquer une réduction de bruit');
    recommendations.push('Utiliser un filtre passe-haut pour éliminer les basses fréquences parasites');
  }

  // Dédupliquer
  return [...new Set(recommendations)];
}

module.exports = {
  checkAudioQuality,
  analyzeAudioVolume,
  analyzeSilence,
  QUALITY_THRESHOLDS
};
