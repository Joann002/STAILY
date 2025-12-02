/**
 * Rules Engine pour le Verbatim Corrigé (CV)
 * Applique les règles de transcription professionnelle avec GPT-4o-mini
 */

const OpenAI = require('openai');

/**
 * Règles de verbatim corrigé pour GPT-4o-mini
 */
const VERBATIM_RULES = `
# RÈGLES DE VERBATIM CORRIGÉ (CV)

Tu es un expert en transcription de sous-titres professionnels. Tu dois appliquer les règles suivantes :

## 1. NETTOYAGE DU TEXTE
- Supprimer TOUTES les hésitations : "euh", "hum", "mh", "ben", "pis"
- Supprimer les bégaiements et répétitions inutiles : "j'ai-j'ai", "s-s-soir"
- Supprimer les mots béquille : "du coup", "genre", "comme", "là", "donc" (quand inutiles)
- Supprimer les tics de langage répétitifs
- Garder UNE SEULE hésitation si le locuteur change le sens de sa phrase

## 2. GRAMMAIRE ET SYNTAXE
- Ajouter le "ne" de négation : "j'ai pas" → "je n'ai pas"
- Corriger "si j'aurais" → "si j'avais"
- Corriger les erreurs de pluriel/féminin
- Corriger "fak" → enlever ou remplacer par "alors"
- Corriger la ponctuation pour rendre le texte lisible

## 3. PONCTUATION
- Utiliser la virgule pour les énumérations et compléments
- Ne PAS mettre de virgule à chaque pause orale
- Mettre un point pour marquer la fin d'une idée
- Ne PAS mettre de point devant "et" (enlever le "et" si début de phrase)
- Points de suspension (...) uniquement pour interruptions ou idées non terminées
- Majuscules accentuées obligatoires : "À", "Ça", "É"

## 4. CHIFFRES ET NOMBRES
- Nombres < 10 : en lettres (un, deux, trois)
- Nombres ≥ 10 : en chiffres (26, 300)
- Pourcentages : avec symbole (25 %)
- Fractions : en lettres (deux tiers)
- Montants : 15 $ (avec espace)
- Heure Québec : 14h54 | Heure France : 14:54

## 5. ANGLICISMES ET QUÉBÉCISMES
- Mettre entre guillemets français : « burnout », « check ben »
- Sacres entre guillemets : « caliss », « tabarnak »
- Si répété plusieurs fois dans la vidéo, normaliser sans guillemets

## 6. CITATIONS
- Citations directes : "Elle m'a dit : « Je devrais y aller »"
- Citations indirectes : "Elle m'a dit qu'elle devrait y aller" (sans guillemets)
- Majuscule au début d'une citation directe

## 7. INTERLOCUTEURS MULTIPLES
- Utiliser le tiret (-) pour chaque personne
- Ne PAS nommer les personnes (sauf demande client)
- Points de suspension (...) pour interruptions
- Omettre les interruptions à un mot : "OK", "Miam", "Ah"

## 8. INAUDIBLE
- Utiliser [inaudible] uniquement si vraiment impossible à comprendre
- Faire un effort de compréhension avant de marquer [inaudible]
- Si phrase non essentielle et inaudible : omettre ou mettre "..."

## 9. SACRES ET INJURES
- Écrire normalement sans censure (sauf demande client)

## 10. PERSONNAGE ET CONTEXTE
- Corriger les erreurs d'une personne normale en entrevue
- Garder les erreurs caractéristiques d'un personnage (anglophone, accent)
- Adapter selon le contexte (formel vs familier)

## OBJECTIF FINAL
Le texte doit être CLAIR, LISIBLE et FACILE À COMPRENDRE même sans le son.
Privilégier la clarté à la fidélité exacte à 100%.
`;

/**
 * Applique les règles de verbatim corrigé avec GPT-4o-mini
 * @param {Array} segments - Segments de transcription brute
 * @param {Object} options - Options de traitement
 * @param {string} options.openaiApiKey - Clé API OpenAI
 * @param {string} options.language - Langue (fr, en)
 * @param {string} options.context - Contexte additionnel (optionnel)
 * @returns {Promise<Object>} Résultat avec segments corrigés
 */
async function applyVerbatimRules(segments, options = {}) {
  const {
    openaiApiKey,
    language = 'fr',
    context = ''
  } = options;

  if (!openaiApiKey) {
    throw new Error('Clé API OpenAI requise');
  }

  if (!segments || segments.length === 0) {
    throw new Error('Aucun segment à traiter');
  }

  console.log('\n🎯 === APPLICATION DES RÈGLES DE VERBATIM CORRIGÉ ===');
  console.log(`📝 Segments à traiter: ${segments.length}`);
  console.log(`🌍 Langue: ${language}`);

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Préparer le texte complet avec timestamps
  const fullText = segments.map((seg, idx) => {
    return `[${idx}] (${seg.start?.toFixed(2)}s - ${seg.end?.toFixed(2)}s) ${seg.text}`;
  }).join('\n');

  console.log(`📄 Longueur du texte: ${fullText.length} caractères`);

  // Construire le prompt
  const systemPrompt = VERBATIM_RULES;
  
  const userPrompt = `
Voici une transcription brute à corriger selon les règles de Verbatim Corrigé (CV).

${context ? `CONTEXTE: ${context}\n` : ''}
LANGUE: ${language === 'fr' ? 'Français' : 'Anglais'}

TRANSCRIPTION BRUTE:
${fullText}

INSTRUCTIONS:
1. Applique TOUTES les règles de verbatim corrigé
2. Garde le format [index] (timestamps) pour chaque segment
3. Corrige le texte de chaque segment
4. Retourne UNIQUEMENT les segments corrigés au format JSON suivant:

{
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 2.5,
      "originalText": "texte original",
      "correctedText": "texte corrigé",
      "changes": ["description des changements"]
    }
  ],
  "summary": "Résumé des corrections appliquées",
  "statistics": {
    "totalSegments": 10,
    "segmentsModified": 8,
    "hesitationsRemoved": 15,
    "grammarFixed": 5
  }
}
`;

  try {
    console.log('🤖 Envoi à GPT-4o-mini...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Basse température pour cohérence
      response_format: { type: 'json_object' }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Réponse reçue en ${duration}s`);

    const result = JSON.parse(completion.choices[0].message.content);

    // Validation du résultat
    if (!result.segments || !Array.isArray(result.segments)) {
      throw new Error('Format de réponse invalide');
    }

    console.log(`📊 Statistiques:`);
    console.log(`   - Segments traités: ${result.statistics?.totalSegments || result.segments.length}`);
    console.log(`   - Segments modifiés: ${result.statistics?.segmentsModified || 'N/A'}`);
    console.log(`   - Hésitations supprimées: ${result.statistics?.hesitationsRemoved || 'N/A'}`);
    console.log(`   - Corrections grammaticales: ${result.statistics?.grammarFixed || 'N/A'}`);

    return {
      success: true,
      correctedSegments: result.segments,
      summary: result.summary,
      statistics: result.statistics,
      metadata: {
        model: 'gpt-4o-mini',
        processingTime: `${duration}s`,
        language,
        rulesApplied: 'Verbatim Corrigé (CV)'
      }
    };

  } catch (error) {
    console.error('❌ Erreur GPT:', error.message);
    throw new Error(`Échec de l'application des règles: ${error.message}`);
  }
}

/**
 * Génère un texte complet à partir des segments corrigés
 * @param {Array} correctedSegments - Segments corrigés
 * @returns {string} Texte complet
 */
function generateCorrectedText(correctedSegments) {
  return correctedSegments
    .map(seg => seg.correctedText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Génère un fichier SRT à partir des segments corrigés
 * @param {Array} correctedSegments - Segments corrigés
 * @returns {string} Contenu SRT
 */
function generateCorrectedSRT(correctedSegments) {
  return correctedSegments.map((seg, index) => {
    const startTime = formatSRTTime(seg.start);
    const endTime = formatSRTTime(seg.end);
    
    return `${index + 1}\n${startTime} --> ${endTime}\n${seg.correctedText}\n`;
  }).join('\n');
}

/**
 * Formate un timestamp en format SRT (HH:MM:SS,mmm)
 * @param {number} seconds - Temps en secondes
 * @returns {string} Temps formaté
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

module.exports = {
  applyVerbatimRules,
  generateCorrectedText,
  generateCorrectedSRT,
  VERBATIM_RULES
};
