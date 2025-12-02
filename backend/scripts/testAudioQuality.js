#!/usr/bin/env node
/**
 * Script de test pour analyser la qualité audio d'un fichier
 * Affiche le score, les problèmes détectés et les modèles recommandés
 */

const { checkAudioQuality } = require('../services/audioQualityChecker');
const path = require('path');

// Stratégies de modèles (copié de whisperOrchestrator.js)
const WHISPER_FALLBACK_STRATEGIES = [
  { name: 'TINY_FAST', modelSize: 'tiny', minAudioQuality: 70 },
  { name: 'BASE_STANDARD', modelSize: 'base', minAudioQuality: 50 },
  { name: 'SMALL_BALANCED', modelSize: 'small', minAudioQuality: 30 },
  { name: 'MEDIUM_ROBUST', modelSize: 'medium', minAudioQuality: 20 },
  { name: 'LARGE_ULTIMATE', modelSize: 'large-v3', minAudioQuality: 0 }
];

async function testAudioQuality(audioPath) {
  console.log('🔍 TEST DE QUALITÉ AUDIO');
  console.log('='.repeat(70));
  console.log(`📁 Fichier: ${path.basename(audioPath)}`);
  console.log('='.repeat(70));

  try {
    // Analyser la qualité
    const report = await checkAudioQuality(audioPath);

    // Afficher les résultats détaillés
    console.log('\n📊 RÉSULTATS D\'ANALYSE');
    console.log('─'.repeat(70));
    console.log(`Score de qualité: ${report.qualityScore}/100`);
    console.log(`Niveau: ${report.qualityLevel}`);
    console.log(`Acceptable: ${report.isAcceptable ? '✅ OUI' : '❌ NON'}`);
    console.log(`Amélioration nécessaire: ${report.needsEnhancement ? '⚠️  OUI' : '✅ NON'}`);

    // Statistiques de volume
    console.log('\n🔊 VOLUME');
    console.log('─'.repeat(70));
    console.log(`Volume moyen: ${report.volume.meanVolume?.toFixed(1) || 'N/A'} dB`);
    console.log(`Volume maximum: ${report.volume.maxVolume?.toFixed(1) || 'N/A'} dB`);

    // Statistiques de silence
    console.log('\n🔇 SILENCE');
    console.log('─'.repeat(70));
    console.log(`Durée totale: ${report.silence.totalDuration.toFixed(1)}s`);
    console.log(`Durée de silence: ${report.silence.totalSilenceDuration.toFixed(1)}s`);
    console.log(`Durée de contenu: ${report.silence.nonSilenceDuration.toFixed(1)}s`);
    console.log(`Pourcentage de silence: ${report.silence.silencePercent.toFixed(1)}%`);
    console.log(`Segments de silence: ${report.silence.silenceSegments}`);

    // Problèmes détectés
    if (report.issues.length > 0) {
      console.log('\n⚠️  PROBLÈMES DÉTECTÉS');
      console.log('─'.repeat(70));
      report.issues.forEach((issue, index) => {
        const icon = issue.severity === 'CRITICAL' ? '🔴' : '🟡';
        console.log(`${icon} ${index + 1}. ${issue.type} (${issue.severity})`);
        console.log(`   ${issue.message}`);
      });
    } else {
      console.log('\n✅ AUCUN PROBLÈME DÉTECTÉ');
    }

    // Recommandations
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMANDATIONS');
      console.log('─'.repeat(70));
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Modèles Whisper recommandés
    console.log('\n🤖 MODÈLES WHISPER DISPONIBLES');
    console.log('─'.repeat(70));
    
    const availableStrategies = WHISPER_FALLBACK_STRATEGIES.filter(
      s => report.qualityScore >= s.minAudioQuality
    );

    if (availableStrategies.length === 0) {
      console.log('⚠️  Qualité trop faible, tous les modèles seront tentés');
      WHISPER_FALLBACK_STRATEGIES.forEach((strategy, index) => {
        const icon = index === 0 ? '🎯' : '  ';
        console.log(`${icon} ${strategy.modelSize.padEnd(10)} (${strategy.name})`);
      });
    } else {
      console.log(`${availableStrategies.length} modèle(s) adapté(s) à cette qualité audio:\n`);
      availableStrategies.forEach((strategy, index) => {
        const icon = index === 0 ? '🎯' : '  ';
        const label = index === 0 ? ' ← Sera utilisé en premier' : '';
        console.log(`${icon} ${strategy.modelSize.padEnd(10)} (${strategy.name})${label}`);
      });
    }

    // Stratégie recommandée
    console.log('\n📋 STRATÉGIE DE TRANSCRIPTION');
    console.log('─'.repeat(70));
    
    if (report.qualityScore >= 70) {
      console.log('✅ Excellente qualité → Commence avec tiny (très rapide)');
    } else if (report.qualityScore >= 50) {
      console.log('✅ Qualité acceptable → Commence avec base (rapide)');
    } else if (report.qualityScore >= 30) {
      console.log('⚠️  Qualité médiocre → Commence avec small (plus robuste)');
    } else if (report.qualityScore >= 20) {
      console.log('⚠️  Qualité faible → Commence avec medium (haute précision)');
    } else {
      console.log('❌ Qualité très faible → Utilise large-v3 (précision maximale)');
    }

    if (report.needsEnhancement) {
      console.log('🔧 Amélioration audio sera appliquée automatiquement');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Analyse terminée');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERREUR');
    console.error('─'.repeat(70));
    console.error(error.message);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  const audioPath = process.argv[2];

  if (!audioPath) {
    console.error('❌ Usage: node testAudioQuality.js <audio.wav>');
    console.error('   Exemple: node testAudioQuality.js tmp/audio.wav');
    process.exit(1);
  }

  testAudioQuality(audioPath);
}

module.exports = { testAudioQuality };
