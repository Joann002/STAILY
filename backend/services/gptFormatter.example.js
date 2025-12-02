/**
 * Exemple d'utilisation du service gptFormatter
 * 
 * Pour tester : node backend/services/gptFormatter.example.js
 */

const { formatWithGPT, generateSRTFile } = require('./gptFormatter');

// Exemple de segments nettoyés (après applyRules)
const cleanedSegments = [
  {
    start: 0,
    end: 2.5,
    text: "Bonjour tout le monde"
  },
  {
    start: 2.5,
    end: 6.8,
    text: "Aujourd'hui on va parler de YouTube et MP3"
  },
  {
    start: 6.8,
    end: 10.2,
    text: "C'est très intéressant pour créer des sous-titres automatiquement"
  },
  {
    start: 10.2,
    end: 13.5,
    text: "On utilise l'API OpenAI pour formater le résultat"
  }
];

async function main() {
  try {
    // Charger les variables d'environnement
    require('dotenv').config();
    
    // Récupérer la clé API depuis les variables d'environnement
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Erreur : OPENAI_API_KEY non définie');
      console.log('💡 Définissez-la avec : export OPENAI_API_KEY="sk-..."');
      process.exit(1);
    }

    console.log('🚀 Envoi des segments à GPT-4o-mini...\n');
    
    // Appel à l'API OpenAI
    const result = await formatWithGPT(cleanedSegments, apiKey);
    
    console.log('✅ Réponse reçue !\n');
    
    // Afficher le résumé
    console.log('📝 Résumé :');
    console.log(result.summary);
    console.log('');
    
    // Afficher les sous-titres SRT
    console.log('🎬 Sous-titres SRT :');
    console.log('-------------------');
    const srtContent = generateSRTFile(result.srt);
    console.log(srtContent);
    
    // Sauvegarder le fichier SRT (optionnel)
    const fs = require('fs');
    const outputPath = 'output.srt';
    fs.writeFileSync(outputPath, srtContent);
    console.log(`💾 Fichier SRT sauvegardé : ${outputPath}`);
    
    // Afficher les statistiques
    console.log('\n📊 Statistiques :');
    console.log(`- Nombre de sous-titres : ${result.srt.length}`);
    console.log(`- Durée totale : ${result.srt[result.srt.length - 1].end}`);
    
  } catch (error) {
    console.error('❌ Erreur :', error.message);
    process.exit(1);
  }
}

// Exécuter l'exemple
main();
