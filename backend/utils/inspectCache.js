#!/usr/bin/env node

/**
 * Utilitaire CLI pour inspecter le cache de transcription
 * 
 * Usage:
 *   node backend/utils/inspectCache.js                    # Liste tous les caches
 *   node backend/utils/inspectCache.js <hash>             # Affiche un cache spécifique
 *   node backend/utils/inspectCache.js --stats            # Statistiques du cache
 *   node backend/utils/inspectCache.js --clean [days]     # Nettoie les vieux caches
 */

const {
  loadCache,
  listCaches,
  getCacheStats,
  cleanOldCaches,
  deleteCache
} = require('../services/cacheManager');

// Couleurs pour l'affichage
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * Affiche un cache spécifique
 */
function inspectCache(hash) {
  console.log(colorize('\n🔍 Inspection du cache', 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  
  const cache = loadCache(hash);
  
  if (!cache) {
    console.log(colorize(`\n❌ Cache non trouvé: ${hash}`, 'red'));
    console.log('\n💡 Utilisez sans argument pour lister tous les caches disponibles');
    return;
  }
  
  const { transcription, srt, metadata } = cache;
  
  // Métadonnées
  console.log(colorize('\n📋 Métadonnées:', 'cyan'));
  console.log(`   Hash: ${colorize(metadata.hash || hash, 'yellow')}`);
  console.log(`   Créé le: ${colorize(metadata.createdAt || 'inconnu', 'green')}`);
  console.log(`   Modèle: ${metadata.modelSize || 'inconnu'}`);
  console.log(`   Langue: ${metadata.language || 'inconnu'}`);
  console.log(`   Durée traitement: ${metadata.processingTime || 'inconnu'}`);
  console.log(`   Fichier original: ${metadata.originalFile || 'inconnu'}`);
  
  // Transcription
  if (transcription) {
    console.log(colorize('\n📝 Transcription:', 'cyan'));
    console.log(`   Langue détectée: ${transcription.raw?.language || 'inconnu'}`);
    console.log(`   Durée audio: ${transcription.raw?.duration || 0}s`);
    console.log(`   Segments bruts: ${transcription.raw?.segments?.length || 0}`);
    console.log(`   Segments nettoyés: ${transcription.cleaned?.segments?.length || 0}`);
    
    if (transcription.formatted) {
      console.log(`   Sous-titres SRT: ${transcription.formatted.srt?.length || 0}`);
      console.log(`   Résumé: ${transcription.formatted.summary ? '✅' : '❌'}`);
    }
    
    // Aperçu du texte
    const text = transcription.cleaned?.text || transcription.raw?.text || '';
    if (text) {
      const preview = text.substring(0, 150) + (text.length > 150 ? '...' : '');
      console.log(colorize('\n📄 Aperçu du texte:', 'cyan'));
      console.log(`   "${preview}"`);
    }
  }
  
  // SRT
  if (srt) {
    const lines = srt.split('\n').filter(l => l.trim());
    console.log(colorize('\n🎬 Fichier SRT:', 'cyan'));
    console.log(`   Lignes: ${lines.length}`);
    console.log(`   Taille: ${(srt.length / 1024).toFixed(2)} KB`);
    
    // Aperçu des premiers sous-titres
    const firstSubtitles = srt.split('\n\n').slice(0, 2).join('\n\n');
    if (firstSubtitles) {
      console.log(colorize('\n   Aperçu:', 'yellow'));
      firstSubtitles.split('\n').forEach(line => {
        console.log(`   ${line}`);
      });
    }
  }
  
  console.log(colorize('\n═'.repeat(60), 'blue'));
}

/**
 * Liste tous les caches
 */
function listAllCaches() {
  console.log(colorize('\n📦 Liste des caches disponibles', 'bright'));
  console.log(colorize('═'.repeat(80), 'blue'));
  
  const caches = listCaches();
  
  if (caches.length === 0) {
    console.log(colorize('\n❌ Aucun cache trouvé', 'yellow'));
    return;
  }
  
  console.log(`\n${colorize('Total:', 'cyan')} ${caches.length} cache(s)\n`);
  
  caches.forEach((cache, index) => {
    const date = new Date(cache.createdAt);
    const dateStr = date.toLocaleString('fr-FR');
    const hashShort = cache.hash.substring(0, 12);
    
    console.log(`${colorize(`${index + 1}.`, 'green')} ${colorize(hashShort, 'yellow')}...`);
    console.log(`   Créé: ${dateStr}`);
    console.log(`   Modèle: ${cache.modelSize || 'inconnu'} | Langue: ${cache.language || 'inconnu'}`);
    console.log(`   Fichier: ${cache.originalFile || 'inconnu'}`);
    console.log('');
  });
  
  console.log(colorize('💡 Utilisez: node backend/utils/inspectCache.js <hash> pour voir les détails', 'cyan'));
  console.log(colorize('═'.repeat(80), 'blue'));
}

/**
 * Affiche les statistiques du cache
 */
function showStats() {
  console.log(colorize('\n📊 Statistiques du cache', 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  
  const stats = getCacheStats();
  const caches = listCaches();
  
  console.log(`\n${colorize('Nombre de caches:', 'cyan')} ${stats.cacheCount}`);
  console.log(`${colorize('Fichiers totaux:', 'cyan')} ${stats.fileCount}`);
  console.log(`${colorize('Taille totale:', 'cyan')} ${stats.formattedSize}`);
  
  if (caches.length > 0) {
    const oldest = caches[caches.length - 1];
    const newest = caches[0];
    
    console.log(`\n${colorize('Plus ancien:', 'cyan')} ${new Date(oldest.createdAt).toLocaleString('fr-FR')}`);
    console.log(`${colorize('Plus récent:', 'cyan')} ${new Date(newest.createdAt).toLocaleString('fr-FR')}`);
  }
  
  console.log(colorize('\n═'.repeat(60), 'blue'));
}

/**
 * Nettoie les vieux caches
 */
function cleanCaches(maxAgeDays = 30) {
  console.log(colorize(`\n🧹 Nettoyage des caches > ${maxAgeDays} jours`, 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  
  const deletedCount = cleanOldCaches(maxAgeDays);
  
  if (deletedCount === 0) {
    console.log(colorize('\n✅ Aucun cache à nettoyer', 'green'));
  } else {
    console.log(colorize(`\n✅ ${deletedCount} cache(s) supprimé(s)`, 'green'));
  }
  
  console.log(colorize('═'.repeat(60), 'blue'));
}

/**
 * Supprime un cache spécifique
 */
function removeCacheCmd(hash) {
  console.log(colorize('\n🗑️  Suppression du cache', 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  
  const deleted = deleteCache(hash);
  
  if (deleted) {
    console.log(colorize(`\n✅ Cache supprimé: ${hash.substring(0, 12)}...`, 'green'));
  } else {
    console.log(colorize(`\n❌ Cache non trouvé: ${hash}`, 'red'));
  }
  
  console.log(colorize('═'.repeat(60), 'blue'));
}

/**
 * Affiche l'aide
 */
function showHelp() {
  console.log(colorize('\n📖 Utilitaire d\'inspection du cache', 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  console.log('\nUsage:');
  console.log(`  ${colorize('node backend/utils/inspectCache.js', 'cyan')}                    Liste tous les caches`);
  console.log(`  ${colorize('node backend/utils/inspectCache.js <hash>', 'cyan')}             Affiche un cache spécifique`);
  console.log(`  ${colorize('node backend/utils/inspectCache.js --stats', 'cyan')}            Statistiques du cache`);
  console.log(`  ${colorize('node backend/utils/inspectCache.js --clean [days]', 'cyan')}     Nettoie les vieux caches (défaut: 30j)`);
  console.log(`  ${colorize('node backend/utils/inspectCache.js --delete <hash>', 'cyan')}    Supprime un cache spécifique`);
  console.log(`  ${colorize('node backend/utils/inspectCache.js --help', 'cyan')}             Affiche cette aide`);
  console.log(colorize('═'.repeat(60), 'blue'));
}

// Point d'entrée CLI
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    listAllCaches();
  } else if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
  } else if (args[0] === '--stats') {
    showStats();
  } else if (args[0] === '--clean') {
    const days = parseInt(args[1]) || 30;
    cleanCaches(days);
  } else if (args[0] === '--delete') {
    if (!args[1]) {
      console.log(colorize('\n❌ Hash requis pour --delete', 'red'));
      showHelp();
    } else {
      removeCacheCmd(args[1]);
    }
  } else {
    inspectCache(args[0]);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { inspectCache, listAllCaches, showStats };
