/**
 * Orchestrateur intelligent de transcription Whisper
 * Gère l'analyse de qualité, l'amélioration audio, les fallbacks et la correction GPT
 */

const { checkAudioQuality } = require('./audioQualityChecker');
const { autoEnhance } = require('./audioEnhancer');
const { analyzeTranscriptionQuality } = require('./transcriptionQualityAnalyzer');
const { transcribeAudio } = require('../scripts/transcribeAudio');
const { formatWithGPT } = require('./gptFormatter');
const path = require('path');
const fs = require('fs');

/**
 * Configuration des stratégies de fallback Whisper
 * L'orchestrateur essaiera les modèles dans cet ordre selon la qualité audio
 */
const WHISPER_FALLBACK_STRATEGIES = [
  // Stratégie 1: Modèle tiny - Rapide pour audio de bonne qualité
  {
    name: 'TINY_FAST',
    modelSize: 'tiny',
    description: 'Modèle tiny (rapide, bonne qualité audio)',
    minAudioQuality: 70,
    estimatedSpeed: 'Très rapide (~3s pour 1min audio)'
  },
  // Stratégie 2: Modèle base - Bon compromis vitesse/précision
  {
    name: 'BASE_STANDARD',
    modelSize: 'base',
    description: 'Modèle base (compromis vitesse/précision)',
    minAudioQuality: 50,
    estimatedSpeed: 'Rapide (~10s pour 1min audio)'
  },
  // Stratégie 3: Modèle small - Meilleure précision
  {
    name: 'SMALL_BALANCED',
    modelSize: 'small',
    description: 'Modèle small (précision améliorée)',
    minAudioQuality: 30,
    estimatedSpeed: 'Moyen (~30s pour 1min audio)'
  },
  // Stratégie 4: Modèle medium - Haute précision pour audio difficile
  {
    name: 'MEDIUM_ROBUST',
    modelSize: 'medium',
    description: 'Modèle medium (haute précision)',
    minAudioQuality: 20,
    estimatedSpeed: 'Lent (~90s pour 1min audio)'
  },
  // Stratégie 5: Modèle large-v3 - Précision maximale en dernier recours
  {
    name: 'LARGE_ULTIMATE',
    modelSize: 'large-v3',
    description: 'Modèle large-v3 (précision maximale)',
    minAudioQuality: 0,
    estimatedSpeed: 'Très lent (~180s pour 1min audio)'
  }
];

/**
 * Résultat d'orchestration
 * @typedef {Object} OrchestrationResult
 * @property {boolean} success - Succès de la transcription
 * @property {Object} audioQuality - Rapport de qualité audio
 * @property {Object} transcriptionQuality - Rapport de qualité de transcription
 * @property {Object} transcription - Résultat de transcription
 * @property {Object} enhancement - Informations sur l'amélioration audio
 * @property {Object} fallback - Informations sur les fallbacks utilisés
 * @property {Object} gptCorrection - Correction GPT si appliquée
 * @property {string} finalAudioPath - Chemin du fichier audio utilisé
 * @property {Array<string>} warnings - Avertissements
 * @property {string} userMessage - Message à afficher à l'utilisateur
 */

/**
 * Orchestre la transcription complète avec gestion intelligente de la qualité
 * @param {string} audioPath - Chemin du fichier audio
 * @param {Object} options - Options de transcription
 * @param {string} options.modelSize - Taille du modèle Whisper (défaut: 'base')
 * @param {string} options.language - Langue (défaut: null = auto)
 * @param {boolean} options.autoEnhance - Amélioration audio automatique (défaut: true)
 * @param {boolean} options.useFallback - Utiliser les fallbacks (défaut: true)
 * @param {boolean} options.useGPTCorrection - Correction GPT si qualité faible (défaut: true)
 * @param {string} options.openaiApiKey - Clé API OpenAI
 * @returns {Promise<OrchestrationResult>}
 */
async function orchestrateTranscription(audioPath, options = {}) {
  const {
    modelSize = 'large-v3',
    language = null,
    autoEnhance: autoEnhanceEnabled = true,
    useFallback = true,
    useGPTCorrection = true,
    openaiApiKey = null
  } = options;

  console.log('\n🎬 === ORCHESTRATION INTELLIGENTE DE TRANSCRIPTION ===');
  console.log(`📁 Fichier: ${path.basename(audioPath)}`);
  console.log(`🤖 Modèle initial: ${modelSize}`);
  console.log(`🔧 Amélioration auto: ${autoEnhanceEnabled ? 'OUI' : 'NON'}`);
  console.log(`🔄 Fallbacks: ${useFallback ? 'OUI' : 'NON'}`);
  console.log(`🧠 Correction GPT: ${useGPTCorrection ? 'OUI' : 'NON'}`);

  const result = {
    success: false,
    audioQuality: null,
    transcriptionQuality: null,
    transcription: null,
    enhancement: null,
    fallback: null,
    gptCorrection: null,
    finalAudioPath: audioPath,
    warnings: [],
    userMessage: ''
  };

  try {
    // ÉTAPE 1: Analyse de la qualité audio
    console.log('\n📍 ÉTAPE 1: Analyse de la qualité audio');
    const audioQualityReport = await checkAudioQuality(audioPath);
    result.audioQuality = audioQualityReport;

    let workingAudioPath = audioPath;

    // ÉTAPE 2: Amélioration audio si nécessaire
    if (autoEnhanceEnabled && audioQualityReport.needsEnhancement) {
      console.log('\n📍 ÉTAPE 2: Amélioration audio nécessaire');
      try {
        const enhancement = await autoEnhance(audioPath, audioQualityReport);
        result.enhancement = enhancement;
        workingAudioPath = enhancement.enhancedPath;
        result.finalAudioPath = workingAudioPath;
        
        console.log(`✅ Audio amélioré: ${path.basename(workingAudioPath)}`);
        result.warnings.push(`Audio amélioré avec preset ${enhancement.preset}`);
      } catch (enhanceError) {
        console.error(`⚠️  Échec amélioration audio: ${enhanceError.message}`);
        result.warnings.push(`Impossible d'améliorer l'audio: ${enhanceError.message}`);
      }
    } else if (!audioQualityReport.needsEnhancement) {
      console.log('\n📍 ÉTAPE 2: Qualité audio acceptable, pas d\'amélioration nécessaire');
    } else {
      console.log('\n📍 ÉTAPE 2: Amélioration audio désactivée');
    }

    // ÉTAPE 3: Tentative de transcription avec stratégie de fallback intelligente
    console.log('\n📍 ÉTAPE 3: Transcription avec Whisper (stratégie adaptative)');
    
    let transcription = null;
    let transcriptionQualityReport = null;
    let usedStrategy = null;
    const attemptedStrategies = [];

    // Construire la liste des stratégies à essayer
    let strategies;
    
    if (useFallback) {
      // Filtrer les stratégies selon la qualité audio
      const audioScore = audioQualityReport.qualityScore;
      strategies = WHISPER_FALLBACK_STRATEGIES.filter(s => audioScore >= s.minAudioQuality);
      
      console.log(`   📊 Qualité audio: ${audioScore}/100 → ${strategies.length} stratégies disponibles`);
      
      // Si aucune stratégie ne correspond, utiliser toutes les stratégies
      if (strategies.length === 0) {
        console.log(`   ⚠️  Audio de très mauvaise qualité, tentative avec tous les modèles`);
        strategies = WHISPER_FALLBACK_STRATEGIES;
      }
    } else {
      // Mode manuel: utiliser uniquement le modèle spécifié
      strategies = [{ 
        name: 'USER_SPECIFIED', 
        modelSize, 
        description: `Modèle ${modelSize} spécifié`,
        estimatedSpeed: 'Variable'
      }];
    }

    // Essayer chaque stratégie jusqu'à obtenir une transcription acceptable
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const isLastStrategy = i === strategies.length - 1;
      
      console.log(`\n   🔄 Tentative ${i + 1}/${strategies.length}: ${strategy.description}`);
      console.log(`      Modèle: ${strategy.modelSize} | Vitesse: ${strategy.estimatedSpeed || 'N/A'}`);
      attemptedStrategies.push(strategy.name);

      try {
        const startTime = Date.now();
        
        // Transcription
        transcription = await transcribeAudio(workingAudioPath, strategy.modelSize, language);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`      ⏱️  Temps de transcription: ${duration}s`);
        
        // Analyse de qualité
        transcriptionQualityReport = analyzeTranscriptionQuality(transcription);
        
        console.log(`      📊 Qualité transcription: ${transcriptionQualityReport.qualityScore}/100 (${transcriptionQualityReport.qualityLevel})`);
        console.log(`      📝 Segments obtenus: ${transcription.segments.length}`);
        
        // Si la qualité est acceptable, on arrête
        if (transcriptionQualityReport.isAcceptable) {
          console.log(`   ✅ Transcription acceptable obtenue avec ${strategy.modelSize}`);
          usedStrategy = strategy;
          break;
        } else {
          console.log(`   ⚠️  Qualité insuffisante avec ${strategy.modelSize}`);
          
          // Si c'est la dernière stratégie, on garde quand même le résultat
          if (isLastStrategy) {
            console.log(`   ℹ️  Dernière stratégie, conservation du meilleur résultat disponible`);
            usedStrategy = strategy;
          } else {
            console.log(`   🔄 Passage au modèle suivant: ${strategies[i + 1].modelSize}`);
          }
        }
      } catch (transcribeError) {
        console.error(`   ❌ Échec avec ${strategy.modelSize}: ${transcribeError.message}`);
        
        // Si c'est la dernière stratégie, on propage l'erreur
        if (isLastStrategy) {
          throw transcribeError;
        } else {
          console.log(`   🔄 Tentative avec le modèle suivant...`);
        }
      }
    }

    result.transcription = transcription;
    result.transcriptionQuality = transcriptionQualityReport;
    result.fallback = {
      strategiesAttempted: attemptedStrategies,
      usedStrategy: usedStrategy?.name,
      usedModel: usedStrategy?.modelSize
    };

    // ÉTAPE 4: Correction GPT si qualité insuffisante
    if (useGPTCorrection && transcriptionQualityReport && !transcriptionQualityReport.isAcceptable) {
      console.log('\n📍 ÉTAPE 4: Correction GPT nécessaire');
      
      if (!openaiApiKey) {
        console.log('   ⚠️  Clé API OpenAI non fournie, correction GPT ignorée');
        result.warnings.push('Correction GPT non disponible (clé API manquante)');
      } else {
        try {
          console.log('   🧠 Envoi à GPT-4o-mini pour correction...');
          
          // Préparer les segments pour GPT
          const segments = transcription.segments.map(s => ({
            start: s.start,
            end: s.end,
            text: s.text
          }));

          const gptResult = await formatWithGPT(segments, openaiApiKey);
          result.gptCorrection = gptResult;
          
          console.log(`   ✅ Correction GPT appliquée`);
          console.log(`   📝 Résumé: ${gptResult.summary}`);
          result.warnings.push('Transcription corrigée par GPT-4o-mini');
        } catch (gptError) {
          console.error(`   ⚠️  Échec correction GPT: ${gptError.message}`);
          result.warnings.push(`Correction GPT échouée: ${gptError.message}`);
        }
      }
    } else if (transcriptionQualityReport?.isAcceptable) {
      console.log('\n📍 ÉTAPE 4: Qualité acceptable, correction GPT non nécessaire');
    } else {
      console.log('\n📍 ÉTAPE 4: Correction GPT désactivée');
    }

    // ÉTAPE 5: Déterminer le succès et générer le message utilisateur
    result.success = transcription !== null;
    result.userMessage = generateUserMessage(result);

    console.log('\n✅ === ORCHESTRATION TERMINÉE ===');
    console.log(`📊 Qualité audio: ${audioQualityReport.qualityLevel} (${audioQualityReport.qualityScore}/100)`);
    console.log(`📊 Qualité transcription: ${transcriptionQualityReport?.qualityLevel || 'N/A'} (${transcriptionQualityReport?.qualityScore || 0}/100)`);
    console.log(`🎯 Succès: ${result.success ? 'OUI' : 'NON'}`);
    
    if (result.warnings.length > 0) {
      console.log(`⚠️  Avertissements: ${result.warnings.length}`);
      result.warnings.forEach(w => console.log(`   - ${w}`));
    }

    return result;

  } catch (error) {
    console.error('\n❌ === ERREUR ORCHESTRATION ===');
    console.error(error);
    
    result.success = false;
    result.userMessage = generateErrorMessage(error, result);
    
    throw error;
  }
}

/**
 * Génère un message utilisateur clair basé sur le résultat
 * @param {OrchestrationResult} result - Résultat de l'orchestration
 * @returns {string} Message pour l'utilisateur
 */
function generateUserMessage(result) {
  const messages = [];

  // Message principal selon la qualité
  if (!result.transcription) {
    messages.push('❌ La transcription a échoué.');
  } else if (result.transcriptionQuality?.qualityLevel === 'GOOD') {
    messages.push('✅ Transcription de bonne qualité obtenue.');
  } else if (result.transcriptionQuality?.qualityLevel === 'ACCEPTABLE') {
    messages.push('✅ Transcription acceptable obtenue.');
  } else if (result.transcriptionQuality?.qualityLevel === 'POOR') {
    messages.push('⚠️ Transcription de qualité médiocre. Les résultats peuvent être imprécis.');
  } else {
    messages.push('❌ Transcription de très mauvaise qualité. Les résultats sont probablement inutilisables.');
  }

  // Informations sur la qualité audio
  if (result.audioQuality) {
    if (result.audioQuality.qualityLevel === 'POOR' || result.audioQuality.qualityLevel === 'UNUSABLE') {
      messages.push(`\n🔊 Qualité audio: ${result.audioQuality.qualityLevel}`);
      messages.push('Problèmes détectés:');
      result.audioQuality.issues.forEach(issue => {
        messages.push(`  • ${issue.message}`);
      });
    }
  }

  // Informations sur l'amélioration
  if (result.enhancement) {
    messages.push(`\n🔧 Audio amélioré automatiquement (preset: ${result.enhancement.preset})`);
  }

  // Informations sur les fallbacks
  if (result.fallback && result.fallback.strategiesAttempted.length > 1) {
    messages.push(`\n🔄 ${result.fallback.strategiesAttempted.length} modèles testés`);
    messages.push(`Modèle final utilisé: ${result.fallback.usedModel}`);
  } else if (result.fallback && result.fallback.usedModel) {
    messages.push(`\n🤖 Modèle utilisé: ${result.fallback.usedModel}`);
  }

  // Informations sur la correction GPT
  if (result.gptCorrection) {
    messages.push('\n🧠 Transcription corrigée par GPT-4o-mini');
  }

  // Recommandations
  if (result.transcriptionQuality && result.transcriptionQuality.recommendations.length > 0) {
    messages.push('\n💡 Recommandations:');
    result.transcriptionQuality.recommendations.slice(0, 3).forEach(rec => {
      messages.push(`  • ${rec}`);
    });
  }

  return messages.join('\n');
}

/**
 * Génère un message d'erreur clair pour l'utilisateur
 * @param {Error} error - Erreur survenue
 * @param {OrchestrationResult} result - Résultat partiel
 * @returns {string} Message d'erreur
 */
function generateErrorMessage(error, result) {
  const messages = [
    '❌ Impossible de transcrire le fichier audio.',
    `\nErreur: ${error.message}`
  ];

  // Ajouter des informations contextuelles si disponibles
  if (result.audioQuality) {
    if (result.audioQuality.qualityLevel === 'UNUSABLE') {
      messages.push('\n🔊 La qualité audio est trop mauvaise pour être transcrite.');
      messages.push('Veuillez fournir un fichier audio de meilleure qualité.');
    } else if (result.audioQuality.issues.length > 0) {
      messages.push('\n🔊 Problèmes audio détectés:');
      result.audioQuality.issues.slice(0, 3).forEach(issue => {
        messages.push(`  • ${issue.message}`);
      });
    }
  }

  // Recommandations générales
  messages.push('\n💡 Suggestions:');
  messages.push('  • Vérifiez que le fichier contient bien du contenu audio parlé');
  messages.push('  • Assurez-vous que le volume est suffisant');
  messages.push('  • Réduisez le bruit de fond si possible');
  messages.push('  • Essayez avec un fichier audio de meilleure qualité');

  return messages.join('\n');
}

module.exports = {
  orchestrateTranscription,
  WHISPER_FALLBACK_STRATEGIES
};
