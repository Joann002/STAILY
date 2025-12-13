/**
 * Service d'application de règles NLP sur les transcriptions
 * 
 * Fonctionnalités :
 * - Suppression des mots de la blacklist (filler words)
 * - Remplacement de termes selon un dictionnaire
 * - Découpage des lignes trop longues
 * - Détection et suppression des répétitions/bégaiements
 * - Ajout automatique de guillemets français pour anglicismes/sacres
 * - Nettoyage des phrases commençant par "et"
 * - Ajout d'accents sur les majuscules
 */

const fs = require('fs');
const path = require('path');

/**
 * Charge les règles depuis le fichier JSON
 * @returns {Object} Les règles (blacklist, replacements, maxLineLength)
 */
function loadRules() {
  const rulesPath = path.join(__dirname, '../rules/rules.json');
  const rulesData = fs.readFileSync(rulesPath, 'utf8');
  return JSON.parse(rulesData);
}

/**
 * Normalise un mot pour la comparaison (minuscules, sans ponctuation)
 * @param {string} word - Le mot à normaliser
 * @returns {string} Le mot normalisé
 */
function normalizeWord(word) {
  return word.toLowerCase().replace(/[.,!?;:]/g, '');
}

/**
 * Supprime les mots de la blacklist d'un texte
 * @param {string} text - Le texte à nettoyer
 * @param {Array<string>} blacklist - Liste des mots à supprimer
 * @returns {string} Le texte nettoyé
 */
function removeBlacklistedWords(text, blacklist) {
  const words = text.split(/\s+/);
  const filtered = words.filter(word => {
    const normalized = normalizeWord(word);
    return !blacklist.includes(normalized);
  });
  return filtered.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Applique les remplacements de termes
 * @param {string} text - Le texte à traiter
 * @param {Object} replacements - Dictionnaire de remplacements
 * @returns {string} Le texte avec remplacements appliqués
 */
function applyReplacements(text, replacements) {
  let result = text;
  
  // Tri par longueur décroissante pour éviter les remplacements partiels
  const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    // Utilise une regex avec word boundaries pour remplacer les mots entiers
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    result = result.replace(regex, replacements[key]);
  }
  
  return result;
}

/**
 * Découpe un texte en lignes respectant la longueur maximale
 * @param {string} text - Le texte à découper
 * @param {number} maxLength - Longueur maximale par ligne
 * @returns {string} Le texte découpé avec retours à la ligne
 */
function breakLongLines(text, maxLength) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // Si un mot seul dépasse la limite, on le garde quand même
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
}

/**
 * Supprime les répétitions et bégaiements
 * @param {string} text - Le texte à nettoyer
 * @returns {string} Le texte sans répétitions
 */
function removeStuttering(text) {
  let result = text;
  
  // Supprime les bégaiements de type "j'ai-j'ai" ou "s-s-soir"
  result = result.replace(/(\b\w+)-\1\b/gi, '$1');
  
  // Supprime les répétitions de syllabes "s-s-soir" -> "soir"
  result = result.replace(/(\w)-\1+/g, '$1');
  
  // Supprime les mots répétés consécutifs "vraiment vraiment" -> "vraiment"
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');
  
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Ajoute des guillemets français autour des anglicismes et sacres
 * @param {string} text - Le texte à traiter
 * @param {Array<string>} anglicismes - Liste des anglicismes
 * @param {Array<string>} sacres - Liste des sacres
 * @returns {string} Le texte avec guillemets
 */
function addFrenchQuotes(text, anglicismes = [], sacres = []) {
  let result = text;
  
  // Combine anglicismes et sacres
  const wordsToQuote = [...anglicismes, ...sacres];
  
  // Tri par longueur décroissante pour gérer les expressions multi-mots
  const sorted = wordsToQuote.sort((a, b) => b.length - a.length);
  
  for (const word of sorted) {
    // Évite de mettre des guillemets si le mot est déjà entre guillemets
    const regex = new RegExp(`(?<!«\\s*)\\b${word}\\b(?!\\s*»)`, 'gi');
    result = result.replace(regex, (match) => `« ${match} »`);
  }
  
  return result;
}

/**
 * Nettoie les phrases commençant par "et"
 * @param {string} text - Le texte à nettoyer
 * @returns {string} Le texte nettoyé
 */
function removeLeadingEt(text) {
  // Enlève "et" au début d'une phrase (après un point ou au début du texte)
  return text.replace(/([.!?]\s+)et\s+/gi, '$1').replace(/^et\s+/i, '').trim();
}

/**
 * Ajoute les accents sur les majuscules
 * @param {string} text - Le texte à traiter
 * @returns {string} Le texte avec accents sur majuscules
 */
function addAccentsToCapitals(text) {
  const replacements = {
    'A': 'À',
    'E': 'É',
    'C': 'Ç'
  };
  
  let result = text;
  
  // Remplace uniquement au début des phrases
  result = result.replace(/^A\s/g, 'À ');
  result = result.replace(/([.!?]\s+)A\s/g, '$1À ');
  result = result.replace(/^E\s/g, 'É ');
  result = result.replace(/([.!?]\s+)E\s/g, '$1É ');
  result = result.replace(/\bCa\s/g, 'Ça ');
  
  return result;
}

/**
 * Nettoie les espaces multiples et la ponctuation
 * @param {string} text - Le texte à nettoyer
 * @returns {string} Le texte nettoyé
 */
function cleanPunctuation(text) {
  let result = text;
  
  // Supprime les espaces multiples
  result = result.replace(/\s+/g, ' ');
  
  // Supprime les espaces avant la ponctuation
  result = result.replace(/\s+([.,!?;:])/g, '$1');
  
  // Ajoute un espace après la ponctuation si manquant
  result = result.replace(/([.,!?;:])([^\s»])/g, '$1 $2');
  
  // Gère les guillemets français (espace insécable)
  result = result.replace(/«\s*/g, '« ');
  result = result.replace(/\s*»/g, ' »');
  
  return result.trim();
}

/**
 * Applique toutes les règles sur un segment de transcription
 * @param {Object} segment - Segment avec {text, start, end}
 * @param {Object} rules - Les règles à appliquer
 * @returns {Object} Le segment nettoyé
 */
function cleanSegment(segment, rules) {
  let cleanedText = segment.text;
  
  // 1. Suppression des répétitions et bégaiements
  cleanedText = removeStuttering(cleanedText);
  
  // 2. Suppression des mots blacklistés
  if (rules.blacklist && rules.blacklist.length > 0) {
    cleanedText = removeBlacklistedWords(cleanedText, rules.blacklist);
  }
  
  // 3. Application des remplacements (négations, corrections grammaticales)
  if (rules.replacements && Object.keys(rules.replacements).length > 0) {
    cleanedText = applyReplacements(cleanedText, rules.replacements);
  }
  
  // 4. Ajout des guillemets français pour anglicismes et sacres
  if (rules.anglicismes || rules.sacres) {
    cleanedText = addFrenchQuotes(
      cleanedText,
      rules.anglicismes || [],
      rules.sacres || []
    );
  }
  
  // 5. Nettoyage des phrases commençant par "et"
  cleanedText = removeLeadingEt(cleanedText);
  
  // 6. Ajout des accents sur les majuscules
  cleanedText = addAccentsToCapitals(cleanedText);
  
  // 7. Nettoyage de la ponctuation
  cleanedText = cleanPunctuation(cleanedText);
  
  // 8. Découpage des lignes longues
  if (rules.maxLineLength && cleanedText.length > rules.maxLineLength) {
    cleanedText = breakLongLines(cleanedText, rules.maxLineLength);
  }
  
  return {
    ...segment,
    text: cleanedText,
    originalText: segment.text // Garde l'original pour référence
  };
}

/**
 * Applique les règles sur une transcription complète
 * @param {Array<Object>} segments - Liste des segments de transcription
 * @param {Object} customRules - Règles personnalisées (optionnel)
 * @returns {Array<Object>} Les segments nettoyés
 */
function applyRulesToTranscription(segments, customRules = null) {
  const rules = customRules || loadRules();
  
  return segments.map(segment => cleanSegment(segment, rules));
}

/**
 * Génère un texte complet à partir des segments nettoyés
 * @param {Array<Object>} cleanedSegments - Segments nettoyés
 * @returns {string} Le texte complet
 */
function generateCleanedText(cleanedSegments) {
  return cleanedSegments
    .map(segment => segment.text)
    .filter(text => text.trim().length > 0)
    .join('\n');
}

module.exports = {
  loadRules,
  removeBlacklistedWords,
  applyReplacements,
  breakLongLines,
  removeStuttering,
  addFrenchQuotes,
  removeLeadingEt,
  addAccentsToCapitals,
  cleanPunctuation,
  cleanSegment,
  applyRulesToTranscription,
  generateCleanedText
};
