/**
 * Tests unitaires pour le service applyRules
 * 
 * Pour exécuter : node backend/services/applyRules.test.js
 */

const {
  removeBlacklistedWords,
  applyReplacements,
  breakLongLines,
  cleanSegment,
  applyRulesToTranscription,
  generateCleanedText
} = require('./applyRules');

// Couleurs pour l'affichage
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    testsPassed++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, testName) {
  if (actual === expected) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    testsPassed++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Attendu: "${expected}"`);
    console.log(`  Obtenu:  "${actual}"`);
    testsFailed++;
  }
}

console.log(`${BLUE}=== Tests du service applyRules ===${RESET}\n`);

// Test 1: Suppression des mots blacklistés
console.log(`${BLUE}Test 1: Suppression des mots blacklistés${RESET}`);
const blacklist = ['euh', 'mmh', 'hum'];
assertEquals(
  removeBlacklistedWords('Bonjour euh je suis mmh content', blacklist),
  'Bonjour je suis content',
  'Supprime les filler words'
);
assertEquals(
  removeBlacklistedWords('Euh, bonjour mmh!', blacklist),
  'bonjour',
  'Gère la ponctuation'
);
assertEquals(
  removeBlacklistedWords('Pas de mots à supprimer', blacklist),
  'Pas de mots à supprimer',
  'Texte sans mots blacklistés'
);
console.log('');

// Test 2: Application des remplacements
console.log(`${BLUE}Test 2: Application des remplacements${RESET}`);
const replacements = { 'mp3': 'MP3', 'youtube': 'YouTube', 'api': 'API' };
assertEquals(
  applyReplacements('Télécharge le mp3 depuis youtube', replacements),
  'Télécharge le MP3 depuis YouTube',
  'Remplace les termes techniques'
);
assertEquals(
  applyReplacements('API mp3 YouTube', replacements),
  'API MP3 YouTube',
  'Respecte la casse existante'
);
assertEquals(
  applyReplacements('mp3player', replacements),
  'mp3player',
  'Ne remplace pas les mots partiels'
);
console.log('');

// Test 3: Découpage des lignes longues
console.log(`${BLUE}Test 3: Découpage des lignes longues${RESET}`);
assertEquals(
  breakLongLines('Ceci est une ligne courte', 42),
  'Ceci est une ligne courte',
  'Ligne courte non modifiée'
);
assertEquals(
  breakLongLines('Ceci est une très longue ligne qui dépasse la limite', 42),
  'Ceci est une très longue ligne qui\ndépasse la limite',
  'Découpe ligne longue'
);
assertEquals(
  breakLongLines('Un mot superlongquidepasselalimitemaisunseulmot', 20),
  'Un\nmot\nsuperlongquidepasselalimitemaisunseulmot',
  'Garde les mots longs intacts'
);
console.log('');

// Test 4: Nettoyage d'un segment complet
console.log(`${BLUE}Test 4: Nettoyage d'un segment complet${RESET}`);
const rules = {
  blacklist: ['euh', 'mmh'],
  replacements: { 'mp3': 'MP3', 'youtube': 'YouTube' },
  maxLineLength: 42
};
const segment = {
  text: 'Euh, je télécharge le mp3 depuis youtube pour euh tester',
  start: 0,
  end: 5
};
const cleaned = cleanSegment(segment, rules);
assertEquals(
  cleaned.text,
  'je télécharge le MP3 depuis YouTube\npour tester',
  'Applique toutes les règles'
);
assert(cleaned.originalText === segment.text, 'Conserve le texte original');
console.log('');

// Test 5: Transcription complète
console.log(`${BLUE}Test 5: Transcription complète${RESET}`);
const segments = [
  { text: 'Bonjour euh tout le monde', start: 0, end: 2 },
  { text: 'Aujourd\'hui on parle de youtube et mp3', start: 2, end: 5 },
  { text: 'C\'est mmh très intéressant', start: 5, end: 7 }
];
const cleanedSegments = applyRulesToTranscription(segments, rules);
assertEquals(cleanedSegments.length, 3, 'Conserve le nombre de segments');
assertEquals(
  cleanedSegments[0].text,
  'Bonjour tout le monde',
  'Premier segment nettoyé'
);
assertEquals(
  cleanedSegments[1].text,
  'Aujourd\'hui on parle de YouTube et\nMP3',
  'Deuxième segment avec remplacements et découpage'
);
console.log('');

// Test 6: Génération du texte complet
console.log(`${BLUE}Test 6: Génération du texte complet${RESET}`);
const fullText = generateCleanedText(cleanedSegments);
assert(fullText.includes('Bonjour tout le monde'), 'Contient le premier segment');
assert(fullText.includes('YouTube'), 'Contient les remplacements');
assert(!fullText.includes('euh'), 'Ne contient pas les mots blacklistés');
console.log('');

// Résumé
console.log(`${BLUE}=== Résumé des tests ===${RESET}`);
console.log(`${GREEN}Tests réussis: ${testsPassed}${RESET}`);
console.log(`${RED}Tests échoués: ${testsFailed}${RESET}`);

if (testsFailed === 0) {
  console.log(`\n${GREEN}✓ Tous les tests sont passés !${RESET}`);
  process.exit(0);
} else {
  console.log(`\n${RED}✗ Certains tests ont échoué${RESET}`);
  process.exit(1);
}
