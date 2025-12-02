/**
 * Service d'application de règles NLP sur les transcriptions
 * 
 * Fonctionnalités :
 * - Suppression des mots de la blacklist (filler words)
 * - Remplacement de termes selon un dictionnaire
 * - Découpage des lignes trop longues
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
 * Applique toutes les règles sur un segment de transcription
 * @param {Object} segment - Segment avec {text, start, end}
 * @param {Object} rules - Les règles à appliquer
 * @returns {Object} Le segment nettoyé
 */
function cleanSegment(segment, rules) {
  let cleanedText = segment.text;
  
  // 1. Suppression des mots blacklistés
  if (rules.blacklist && rules.blacklist.length > 0) {
    cleanedText = removeBlacklistedWords(cleanedText, rules.blacklist);
  }
  
  // 2. Application des remplacements
  if (rules.replacements && Object.keys(rules.replacements).length > 0) {
    cleanedText = applyReplacements(cleanedText, rules.replacements);
  }
  
  // 3. Découpage des lignes longues
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
  cleanSegment,
  applyRulesToTranscription,
  generateCleanedText
};
