/**
 * Script de test pour le système de transcription robuste
 * Teste les différents scénarios de qualité audio
 */

const { orchestrateTranscription } = require('../services/whisperOrchestrator');
const { checkAudioQuality } = require('../services/audioQualityChecker');
const { autoEnhance } = require('../services/audioEnhancer');
const path = require('path');
require('dotenv').config();

/**
 * Test complet du système
 */
async function testRobustSystem(audioPath) {
  console.log('\n🧪 === TEST DU SYSTÈME ROBUSTE ===\n');
  console.log(`📁 Fichier: ${audioPath}\n`);

  try {
    // Test 1: Analyse de qualité audio seule
    console.log('📍 TEST 1: Analyse de qualité audio');
    console.log('─'.repeat(50));
    const audioQuality = await checkAudioQuality(audioPath);
    console.log('\n✅ Résultat:');
    console.log(`   Niveau: ${audioQuality.qualityLevel}`);
    console.log(`   Score: ${audioQuality.qualityScore}/100`);
    console.log(`   Acceptable: ${audioQuality.isAcceptable ? 'OUI' : 'NON'}`);
    console.log(`   Amélioration nécessaire: ${audioQuality.needsEnhancement ? 'OUI' : 'NON'}`);
    
    if (audioQuality.issues.length > 0) {
      console.log(`\n   Problèmes détectés (${audioQuality.issues.length}):`);
      audioQuality.issues.forEach(issue => {
        console.log(`   - [${issue.severity}] ${issue.message}`);
      });
    }
    
    if (audioQuality.recommendations.length > 0) {
      console.log(`\n   Recommandations (${audioQuality.recommendations.length}):`);
      audioQuality.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }

    // Test 2: Amélioration audio (si nécessaire)
    if (audioQuality.needsEnhancement) {
      console.log('\n\n📍 TEST 2: Amélioration audio');
      console.log('─'.repeat(50));
      const enhancement = await autoEnhance(audioPath, audioQuality);
      console.log('\n✅ Résultat:');
      console.log(`   Fichier amélioré: ${path.basename(enhancement.enhancedPath)}`);
      console.log(`   Preset utilisé: ${enhancement.preset}`);
      console.log(`   Filtres appliqués: ${enhancement.appliedFilters}`);
    } else {
      console.log('\n\n📍 TEST 2: Amélioration audio');
      console.log('─'.repeat(50));
      console.log('⏭️  Ignoré (qualité audio acceptable)');
    }

    // Test 3: Orchestration complète
    console.log('\n\n📍 TEST 3: Orchestration complète');
    console.log('─'.repeat(50));
    const result = await orchestrateTranscription(audioPath, {
      modelSize: 'base',
      language: null,
      autoEnhance: true,
      useFallback: true,
      useGPTCorrection: true,
      openaiApiKey: process.env.OPENAI_API_KEY
    });

    console.log('\n✅ Résultat:');
    console.log(`   Succès: ${result.success ? 'OUI' : 'NON'}`);
    
    if (result.success) {
      console.log(`\n   Qualité audio: ${result.audioQuality.qualityLevel} (${result.audioQuality.qualityScore}/100)`);
      console.log(`   Qualité transcription: ${result.transcriptionQuality.qualityLevel} (${result.transcriptionQuality.qualityScore}/100)`);
      
      if (result.enhancement) {
        console.log(`\n   Amélioration appliquée: ${result.enhancement.preset}`);
      }
      
      if (result.fallback) {
        console.log(`\n   Stratégies tentées: ${result.fallback.strategiesAttempted.join(', ')}`);
        console.log(`   Modèle utilisé: ${result.fallback.usedModel}`);
      }
      
      if (result.gptCorrection) {
        console.log(`\n   Correction GPT appliquée: OUI`);
        console.log(`   Résumé: ${result.gptCorrection.summary.substring(0, 100)}...`);
      }
      
      if (result.warnings.length > 0) {
        console.log(`\n   Avertissements (${result.warnings.length}):`);
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
      
      console.log(`\n   Transcription (extrait):`);
      const text = result.transcription.text.substring(0, 200);
      console.log(`   "${text}${result.transcription.text.length > 200 ? '...' : ''}"`);
      
      console.log(`\n   Message utilisateur:`);
      console.log('   ' + result.userMessage.split('\n').join('\n   '));
    } else {
      console.log(`\n   ❌ Échec de la transcription`);
      console.log(`\n   Message utilisateur:`);
      console.log('   ' + result.userMessage.split('\n').join('\n   '));
    }

    console.log('\n\n✅ === TESTS TERMINÉS ===\n');

  } catch (error) {
    console.error('\n❌ === ERREUR DURANT LES TESTS ===');
    console.error(error);
    console.error('===================================\n');
    process.exit(1);
  }
}

/**
 * Test rapide de qualité audio uniquement
 */
async function testAudioQualityOnly(audioPath) {
  console.log('\n🔍 === TEST QUALITÉ AUDIO UNIQUEMENT ===\n');
  
  try {
    const report = await checkAudioQuality(audioPath);
    
    console.log('📊 Résultats:');
    console.log('─'.repeat(50));
    console.log(`Niveau de qualité: ${report.qualityLevel}`);
    console.log(`Score: ${report.qualityScore}/100`);
    console.log(`Acceptable: ${report.isAcceptable ? '✅' : '❌'}`);
    console.log(`Amélioration nécessaire: ${report.needsEnhancement ? '✅' : '❌'}`);
    
    console.log('\n📈 Statistiques audio:');
    console.log(`Volume moyen: ${report.volume.meanVolume?.toFixed(1) || 'N/A'} dB`);
    console.log(`Volume maximum: ${report.volume.maxVolume?.toFixed(1) || 'N/A'} dB`);
    console.log(`Durée totale: ${report.silence.totalDuration?.toFixed(1) || 'N/A'} s`);
    console.log(`Silence: ${report.silence.silencePercent?.toFixed(1) || 'N/A'}%`);
    console.log(`Contenu audio: ${report.silence.nonSilenceDuration?.toFixed(1) || 'N/A'} s`);
    
    if (report.issues.length > 0) {
      console.log(`\n⚠️  Problèmes détectés (${report.issues.length}):`);
      report.issues.forEach(issue => {
        console.log(`[${issue.severity}] ${issue.message}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommandations (${report.recommendations.length}):`);
      report.recommendations.forEach(rec => {
        console.log(`- ${rec}`);
      });
    }
    
    console.log('\n✅ === TEST TERMINÉ ===\n');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Ligne de commande
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage:');
    console.error('   node testRobustTranscription.js <audio.wav> [--quality-only]');
    console.error('');
    console.error('Options:');
    console.error('   --quality-only    Teste uniquement la qualité audio (rapide)');
    console.error('');
    console.error('Exemples:');
    console.error('   node testRobustTranscription.js tmp/audio.wav');
    console.error('   node testRobustTranscription.js tmp/audio.wav --quality-only');
    process.exit(1);
  }
  
  const audioPath = args[0];
  const qualityOnly = args.includes('--quality-only');
  
  if (qualityOnly) {
    testAudioQualityOnly(audioPath);
  } else {
    testRobustSystem(audioPath);
  }
}

module.exports = {
  testRobustSystem,
  testAudioQualityOnly
};
