/**
 * Module d'analyse de qualité de transcription Whisper
 * Détecte les transcriptions de mauvaise qualité (segments vides, texte incohérent, etc.)
 */

/**
 * Seuils de qualité pour la transcription
 */
const TRANSCRIPTION_QUALITY_THRESHOLDS = {
  // Pourcentage minimum de segments non vides
  MIN_NON_EMPTY_SEGMENTS_PERCENT: 30,
  
  // Nombre minimum de tokens par segment (moyenne)
  MIN_AVG_TOKENS_PER_SEGMENT: 3,
  
  // Probabilité minimum de la langue détectée
  MIN_LANGUAGE_PROBABILITY: 0.5,
  
  // Pourcentage maximum de segments avec probabilité faible
  MAX_LOW_PROBABILITY_SEGMENTS_PERCENT: 50,
  
  // Seuil de probabilité faible pour un segment
  LOW_PROBABILITY_THRESHOLD: 0.3,
  
  // Nombre minimum de caractères dans la transcription complète
  MIN_TOTAL_CHARACTERS: 10,
  
  // Ratio minimum de mots uniques (détecte les répétitions)
  MIN_UNIQUE_WORDS_RATIO: 0.3
};

/**
 * Compte les tokens dans un texte (approximation simple)
 * @param {string} text - Texte à analyser
 * @returns {number} Nombre de tokens
 */
function countTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Analyse la qualité d'un segment de transcription
 * @param {Object} segment - Segment Whisper
 * @returns {Object} Analyse du segment
 */
function analyzeSegment(segment) {
  const text = segment.text || '';
  const tokens = countTokens(text);
  const isEmpty = text.trim().length === 0;
  const probability = segment.avg_logprob !== undefined 
    ? Math.exp(segment.avg_logprob) 
    : (segment.probability || 1);

  return {
    isEmpty,
    tokens,
    characters: text.length,
    probability,
    isLowProbability: probability < TRANSCRIPTION_QUALITY_THRESHOLDS.LOW_PROBABILITY_THRESHOLD,
    duration: segment.end - segment.start
  };
}

/**
 * Analyse la qualité globale d'une transcription Whisper
 * @param {Object} transcription - Résultat de transcription Whisper
 * @returns {Object} Rapport de qualité
 */
function analyzeTranscriptionQuality(transcription) {
  console.log(`\n🔍 Analyse de qualité de transcription...`);

  const segments = transcription.segments || [];
  const fullText = transcription.text || '';
  const language = transcription.language || 'unknown';
  const languageProbability = transcription.language_probability || 0;

  // Analyser chaque segment
  const segmentAnalyses = segments.map(analyzeSegment);

  // Statistiques globales
  const totalSegments = segments.length;
  const emptySegments = segmentAnalyses.filter(s => s.isEmpty).length;
  const nonEmptySegments = totalSegments - emptySegments;
  const nonEmptyPercent = totalSegments > 0 ? (nonEmptySegments / totalSegments) * 100 : 0;

  const totalTokens = segmentAnalyses.reduce((sum, s) => sum + s.tokens, 0);
  const avgTokensPerSegment = nonEmptySegments > 0 ? totalTokens / nonEmptySegments : 0;

  const lowProbabilitySegments = segmentAnalyses.filter(s => s.isLowProbability).length;
  const lowProbabilityPercent = totalSegments > 0 ? (lowProbabilitySegments / totalSegments) * 100 : 0;

  const totalCharacters = fullText.length;

  // Analyser les mots uniques (détecte les répétitions anormales)
  const words = fullText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  const uniqueWordsRatio = words.length > 0 ? uniqueWords.size / words.length : 0;

  // Détecter les problèmes
  const issues = [];
  let qualityScore = 100;

  // Vérifier les segments vides
  if (nonEmptyPercent < TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_NON_EMPTY_SEGMENTS_PERCENT) {
    issues.push({
      type: 'TOO_MANY_EMPTY_SEGMENTS',
      severity: 'CRITICAL',
      message: `Trop de segments vides: ${emptySegments}/${totalSegments} (${(100 - nonEmptyPercent).toFixed(1)}%)`,
      value: nonEmptyPercent,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_NON_EMPTY_SEGMENTS_PERCENT
    });
    qualityScore -= 40;
  }

  // Vérifier le nombre de tokens par segment
  if (avgTokensPerSegment < TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_AVG_TOKENS_PER_SEGMENT) {
    issues.push({
      type: 'LOW_TOKEN_COUNT',
      severity: 'HIGH',
      message: `Segments trop courts: ${avgTokensPerSegment.toFixed(1)} tokens/segment (minimum: ${TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_AVG_TOKENS_PER_SEGMENT})`,
      value: avgTokensPerSegment,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_AVG_TOKENS_PER_SEGMENT
    });
    qualityScore -= 25;
  }

  // Vérifier la probabilité de la langue
  if (languageProbability < TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_LANGUAGE_PROBABILITY) {
    issues.push({
      type: 'LOW_LANGUAGE_CONFIDENCE',
      severity: 'HIGH',
      message: `Faible confiance de détection de langue: ${(languageProbability * 100).toFixed(1)}% (minimum: ${TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_LANGUAGE_PROBABILITY * 100}%)`,
      value: languageProbability,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_LANGUAGE_PROBABILITY
    });
    qualityScore -= 20;
  }

  // Vérifier les segments à faible probabilité
  if (lowProbabilityPercent > TRANSCRIPTION_QUALITY_THRESHOLDS.MAX_LOW_PROBABILITY_SEGMENTS_PERCENT) {
    issues.push({
      type: 'TOO_MANY_LOW_PROBABILITY_SEGMENTS',
      severity: 'HIGH',
      message: `Trop de segments incertains: ${lowProbabilitySegments}/${totalSegments} (${lowProbabilityPercent.toFixed(1)}%)`,
      value: lowProbabilityPercent,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MAX_LOW_PROBABILITY_SEGMENTS_PERCENT
    });
    qualityScore -= 20;
  }

  // Vérifier la longueur totale
  if (totalCharacters < TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_TOTAL_CHARACTERS) {
    issues.push({
      type: 'INSUFFICIENT_CONTENT',
      severity: 'CRITICAL',
      message: `Transcription trop courte: ${totalCharacters} caractères (minimum: ${TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_TOTAL_CHARACTERS})`,
      value: totalCharacters,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_TOTAL_CHARACTERS
    });
    qualityScore -= 50;
  }

  // Vérifier les répétitions anormales
  if (uniqueWordsRatio < TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_UNIQUE_WORDS_RATIO && words.length > 10) {
    issues.push({
      type: 'EXCESSIVE_REPETITION',
      severity: 'MEDIUM',
      message: `Répétitions excessives détectées: ${(uniqueWordsRatio * 100).toFixed(1)}% de mots uniques (minimum: ${TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_UNIQUE_WORDS_RATIO * 100}%)`,
      value: uniqueWordsRatio,
      threshold: TRANSCRIPTION_QUALITY_THRESHOLDS.MIN_UNIQUE_WORDS_RATIO
    });
    qualityScore -= 15;
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
    needsRetry: qualityScore < 70,
    statistics: {
      totalSegments,
      emptySegments,
      nonEmptySegments,
      nonEmptyPercent,
      totalTokens,
      avgTokensPerSegment,
      lowProbabilitySegments,
      lowProbabilityPercent,
      totalCharacters,
      totalWords: words.length,
      uniqueWords: uniqueWords.size,
      uniqueWordsRatio,
      language,
      languageProbability
    },
    issues,
    recommendations: generateTranscriptionRecommendations(issues, qualityScore)
  };

  // Afficher le résumé
  console.log(`\n   📈 Résultat: ${qualityLevel} (score: ${report.qualityScore}/100)`);
  console.log(`   📊 Segments: ${nonEmptySegments}/${totalSegments} non vides`);
  console.log(`   📝 Contenu: ${totalCharacters} caractères, ${words.length} mots`);
  console.log(`   🌍 Langue: ${language} (${(languageProbability * 100).toFixed(1)}%)`);
  
  if (issues.length > 0) {
    console.log(`   ⚠️  ${issues.length} problème(s) détecté(s):`);
    issues.forEach(issue => {
      console.log(`      - ${issue.message}`);
    });
  } else {
    console.log(`   ✅ Aucun problème détecté`);
  }

  return report;
}

/**
 * Génère des recommandations basées sur les problèmes de transcription
 * @param {Array<Object>} issues - Liste des problèmes
 * @param {number} qualityScore - Score de qualité
 * @returns {Array<string>} Recommandations
 */
function generateTranscriptionRecommendations(issues, qualityScore) {
  const recommendations = [];

  // Recommandations spécifiques par type de problème
  issues.forEach(issue => {
    switch (issue.type) {
      case 'TOO_MANY_EMPTY_SEGMENTS':
      case 'INSUFFICIENT_CONTENT':
        recommendations.push('Améliorer la qualité audio avant transcription');
        recommendations.push('Vérifier que le fichier contient bien du contenu parlé');
        break;
      case 'LOW_TOKEN_COUNT':
        recommendations.push('Utiliser un modèle Whisper plus grand (medium ou large)');
        break;
      case 'LOW_LANGUAGE_CONFIDENCE':
        recommendations.push('Spécifier explicitement la langue de la transcription');
        recommendations.push('Vérifier que l\'audio contient bien de la parole');
        break;
      case 'TOO_MANY_LOW_PROBABILITY_SEGMENTS':
        recommendations.push('Améliorer la qualité audio (réduction de bruit, normalisation)');
        recommendations.push('Utiliser un modèle Whisper plus robuste');
        break;
      case 'EXCESSIVE_REPETITION':
        recommendations.push('Vérifier la qualité audio (possibles artefacts)');
        recommendations.push('Ajuster les paramètres Whisper (temperature, beam_size)');
        break;
    }
  });

  // Recommandations générales selon le score
  if (qualityScore < 30) {
    recommendations.push('⚠️ Transcription inutilisable - Amélioration audio critique nécessaire');
    recommendations.push('Envisager une correction manuelle ou un autre service de transcription');
  } else if (qualityScore < 50) {
    recommendations.push('Réessayer avec des paramètres Whisper optimisés');
    recommendations.push('Utiliser GPT pour corriger et améliorer le texte');
  }

  // Dédupliquer
  return [...new Set(recommendations)];
}

module.exports = {
  analyzeTranscriptionQuality,
  analyzeSegment,
  countTokens,
  TRANSCRIPTION_QUALITY_THRESHOLDS
};
