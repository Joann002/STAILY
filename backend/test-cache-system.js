/**
 * Script de test du système de cache
 * Simule 2 uploads du même fichier pour vérifier que le cache fonctionne
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3002';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCacheSystem() {
  console.log('\n' + '='.repeat(80));
  log('cyan', '🧪 TEST DU SYSTÈME DE CACHE');
  console.log('='.repeat(80) + '\n');
  
  // Utiliser un des fichiers déjà uploadés
  const testFile = 'uploads/Bonus_Soral_rA_pond_-_comment_sera_la_France_en_20-1764540431201-57762862.mp4';
  const testFilePath = path.join(__dirname, testFile);
  
  if (!fs.existsSync(testFilePath)) {
    log('red', '❌ Fichier de test introuvable: ' + testFile);
    log('yellow', '   Veuillez d\'abord uploader un fichier via POST /upload');
    return;
  }
  
  log('blue', `📁 Fichier de test: ${testFile}`);
  log('blue', `📊 Taille: ${(fs.statSync(testFilePath).size / (1024 * 1024)).toFixed(2)} MB\n`);
  
  // TEST 1: Premier traitement (sans cache)
  console.log('─'.repeat(80));
  log('cyan', '📍 TEST 1: Premier traitement (SANS cache)');
  console.log('─'.repeat(80));
  
  const start1 = Date.now();
  
  try {
    const response1 = await axios.post(`${API_URL}/transcribe-robust`, {
      filePath: testFile,
      modelSize: 'tiny',
      language: 'fr',
      useCache: true,
      autoEnhance: false,
      useFallback: false,
      useGPTCorrection: false,
      saveSRT: false
    });
    
    const time1 = ((Date.now() - start1) / 1000).toFixed(2);
    
    log('green', `✅ Succès en ${time1}s`);
    log('blue', `   fromCache: ${response1.data.fromCache}`);
    log('blue', `   Segments: ${response1.data.raw?.segments?.length || 0}`);
    
    if (response1.data.fromCache) {
      log('yellow', '   ⚠️  ATTENTION: Le cache était déjà présent !');
    }
  } catch (error) {
    log('red', `❌ Erreur: ${error.message}`);
    if (error.response) {
      log('red', `   Détails: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return;
  }
  
  console.log('\n');
  
  // TEST 2: Deuxième traitement (avec cache)
  console.log('─'.repeat(80));
  log('cyan', '📍 TEST 2: Deuxième traitement (AVEC cache)');
  console.log('─'.repeat(80));
  
  const start2 = Date.now();
  
  try {
    const response2 = await axios.post(`${API_URL}/transcribe-robust`, {
      filePath: testFile,
      modelSize: 'tiny',
      language: 'fr',
      useCache: true,
      autoEnhance: false,
      useFallback: false,
      useGPTCorrection: false,
      saveSRT: false
    });
    
    const time2 = ((Date.now() - start2) / 1000).toFixed(2);
    
    log('green', `✅ Succès en ${time2}s`);
    log('blue', `   fromCache: ${response2.data.fromCache}`);
    log('blue', `   Segments: ${response2.data.raw?.segments?.length || 0}`);
    
    if (response2.data.cacheMetadata) {
      log('blue', `   Cache créé: ${new Date(response2.data.cacheMetadata.createdAt).toLocaleString('fr-FR')}`);
      log('blue', `   Temps sauvegardé: ${response2.data.cacheMetadata.processingTime}`);
    }
    
    if (!response2.data.fromCache) {
      log('red', '   ❌ PROBLÈME: Le cache n\'a pas été utilisé !');
    }
  } catch (error) {
    log('red', `❌ Erreur: ${error.message}`);
    if (error.response) {
      log('red', `   Détails: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return;
  }
  
  console.log('\n');
  
  // Vérifier le contenu du cache
  console.log('─'.repeat(80));
  log('cyan', '📍 VÉRIFICATION: Contenu du dossier cache');
  console.log('─'.repeat(80));
  
  const cacheDir = path.join(__dirname, 'cache');
  const cacheFiles = fs.readdirSync(cacheDir);
  
  log('blue', `   Fichiers dans cache/: ${cacheFiles.length}`);
  
  cacheFiles.forEach(file => {
    const stats = fs.statSync(path.join(cacheDir, file));
    const size = (stats.size / 1024).toFixed(2);
    log('blue', `   - ${file} (${size} KB)`);
  });
  
  console.log('\n' + '='.repeat(80));
  log('green', '✅ TEST TERMINÉ');
  console.log('='.repeat(80) + '\n');
}

// Exécuter le test
testCacheSystem().catch(error => {
  log('red', `\n❌ Erreur fatale: ${error.message}`);
  process.exit(1);
});
