/**
 * Script de test pour le Rules Engine
 * Usage: node backend/scripts/testRulesEngine.js
 */

const { applyVerbatimRules } = require('../services/rulesEngine');
require('dotenv').config();

// Segments de test avec problèmes typiques
const testSegments = [
  {
    id: 0,
    start: 0.0,
    end: 3.5,
    text: "Euh, bonjour, euh, j'ai-j'ai vraiment trop mangé du gâteau hier s-s-soir"
  },
  {
    id: 1,
    start: 3.5,
    end: 7.2,
    text: "Pis j'ai pas voulu arrêter même euh... même quand c'était pu bon, scusez"
  },
  {
    id: 2,
    start: 7.2,
    end: 11.0,
    text: "Du coup, genre, je pense que, là, c'est important de faire attention à ce qu'on mange"
  },
  {
    id: 3,
    start: 11.0,
    end: 14.5,
    text: "Si j'aurais su, fak j'aurais mangé moins de gâteau"
  },
  {
    id: 4,
    start: 14.5,
    end: 18.0,
    text: "Va chercher, des carottes du pain, et du beurre, avec de l'ail dedans"
  },
  {
    id: 5,
    start: 18.0,
    end: 21.5,
    text: "J'ai fait un burnout à cause du travail, check ben ça"
  },
  {
    id: 6,
    start: 21.5,
    end: 25.0,
    text: "Y'a environ 25 pour cent des gens qui mangent 2/3 de leur repas le soir"
  },
  {
    id: 7,
    start: 25.0,
    end: 28.5,
    text: "Ça coûte 15$ et c'est disponible à 14h30"
  }
];

async function testRulesEngine() {
  console.log('\n🧪 === TEST DU RULES ENGINE ===\n');
  
  // Vérifier la clé API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY non définie dans .env');
    console.log('   Créez un fichier backend/.env avec:');
    console.log('   OPENAI_API_KEY=sk-...');
    process.exit(1);
  }
  
  console.log('✅ Clé API OpenAI trouvée');
  console.log(`📝 Segments de test: ${testSegments.length}\n`);
  
  // Afficher les segments originaux
  console.log('📄 TEXTE BRUT:');
  console.log('─'.repeat(80));
  testSegments.forEach(seg => {
    console.log(`[${seg.id}] (${seg.start}s - ${seg.end}s)`);
    console.log(`    ${seg.text}`);
  });
  console.log('─'.repeat(80));
  
  try {
    console.log('\n🤖 Envoi à GPT-4o-mini pour application des règles...\n');
    
    const startTime = Date.now();
    
    const result = await applyVerbatimRules(testSegments, {
      openaiApiKey: apiKey,
      language: 'fr',
      context: 'Conversation informelle'
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Traitement terminé en ${duration}s\n`);
    
    // Afficher le résumé
    console.log('📊 RÉSUMÉ:');
    console.log('─'.repeat(80));
    console.log(result.summary);
    console.log('─'.repeat(80));
    
    // Afficher les statistiques
    if (result.statistics) {
      console.log('\n📈 STATISTIQUES:');
      console.log('─'.repeat(80));
      console.log(`Segments totaux:          ${result.statistics.totalSegments}`);
      console.log(`Segments modifiés:        ${result.statistics.segmentsModified}`);
      console.log(`Hésitations supprimées:   ${result.statistics.hesitationsRemoved}`);
      console.log(`Corrections grammaticales: ${result.statistics.grammarFixed}`);
      console.log('─'.repeat(80));
    }
    
    // Afficher les segments corrigés avec comparaison
    console.log('\n✨ TEXTE CORRIGÉ (avec comparaison):');
    console.log('─'.repeat(80));
    
    result.correctedSegments.forEach(seg => {
      console.log(`\n[${seg.id}] (${seg.start}s - ${seg.end}s)`);
      console.log(`📄 Original:  ${seg.originalText}`);
      console.log(`✨ Corrigé:   ${seg.correctedText}`);
      
      if (seg.changes && seg.changes.length > 0) {
        console.log(`🔧 Modifications:`);
        seg.changes.forEach(change => {
          console.log(`   • ${change}`);
        });
      }
    });
    
    console.log('\n' + '─'.repeat(80));
    
    // Afficher le texte complet corrigé
    const fullCorrectedText = result.correctedSegments
      .map(seg => seg.correctedText)
      .join(' ');
    
    console.log('\n📝 TEXTE COMPLET CORRIGÉ:');
    console.log('─'.repeat(80));
    console.log(fullCorrectedText);
    console.log('─'.repeat(80));
    
    console.log('\n✅ === TEST RÉUSSI ===\n');
    
  } catch (error) {
    console.error('\n❌ === ERREUR ===');
    console.error(error.message);
    console.error('\nDétails:', error);
    process.exit(1);
  }
}

// Exécuter le test
testRulesEngine();
