/**
 * Gestionnaire de cache pour les transcriptions
 * Évite de retraiter les fichiers déjà transcrits en utilisant un hash SHA-256
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Dossier de cache
const CACHE_DIR = path.join(__dirname, '../cache');

/**
 * Initialise le dossier de cache s'il n'existe pas
 */
function initCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('📁 Dossier cache/ créé');
  }
}

/**
 * Calcule le hash SHA-256 d'un fichier
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<string>} Hash SHA-256 en hexadécimal
 */
function computeHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    
    stream.on('end', () => {
      const fileHash = hash.digest('hex');
      resolve(fileHash);
    });
    
    stream.on('error', (error) => {
      reject(new Error(`Erreur calcul hash: ${error.message}`));
    });
  });
}

/**
 * Vérifie si un fichier est en cache
 * @param {string} hash - Hash SHA-256 du fichier
 * @returns {boolean} true si le cache existe
 */
function isCached(hash) {
  const jsonPath = path.join(CACHE_DIR, `${hash}.json`);
  return fs.existsSync(jsonPath);
}

/**
 * Sauvegarde une transcription dans le cache
 * @param {string} hash - Hash SHA-256 du fichier
 * @param {Object} transcriptionData - Données de transcription complètes
 * @param {string} srtContent - Contenu du fichier SRT (optionnel)
 * @param {Object} metadata - Métadonnées (modèle, durée traitement, etc.)
 * @returns {Object} Chemins des fichiers créés
 */
function saveCache(hash, transcriptionData, srtContent = null, metadata = {}) {
  initCacheDir();
  
  const jsonPath = path.join(CACHE_DIR, `${hash}.json`);
  const srtPath = path.join(CACHE_DIR, `${hash}.srt`);
  const metaPath = path.join(CACHE_DIR, `${hash}.meta.json`);
  
  // Sauvegarder la transcription JSON
  fs.writeFileSync(jsonPath, JSON.stringify(transcriptionData, null, 2));
  
  // Sauvegarder le fichier SRT si fourni
  if (srtContent) {
    fs.writeFileSync(srtPath, srtContent);
  }
  
  // Sauvegarder les métadonnées
  const meta = {
    hash,
    createdAt: new Date().toISOString(),
    ...metadata
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  console.log(`💾 Cache sauvegardé: ${hash.substring(0, 12)}...`);
  
  return {
    jsonPath,
    srtPath: srtContent ? srtPath : null,
    metaPath
  };
}

/**
 * Charge une transcription depuis le cache
 * @param {string} hash - Hash SHA-256 du fichier
 * @returns {Object|null} {transcription, srt, metadata} ou null si non trouvé
 */
function loadCache(hash) {
  const jsonPath = path.join(CACHE_DIR, `${hash}.json`);
  const srtPath = path.join(CACHE_DIR, `${hash}.srt`);
  const metaPath = path.join(CACHE_DIR, `${hash}.meta.json`);
  
  if (!fs.existsSync(jsonPath)) {
    return null;
  }
  
  try {
    // Charger la transcription
    const transcription = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Charger le SRT si disponible
    let srt = null;
    if (fs.existsSync(srtPath)) {
      srt = fs.readFileSync(srtPath, 'utf8');
    }
    
    // Charger les métadonnées
    let metadata = {};
    if (fs.existsSync(metaPath)) {
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
    
    console.log(`✅ Cache trouvé: ${hash.substring(0, 12)}... (créé le ${metadata.createdAt || 'inconnu'})`);
    
    return {
      transcription,
      srt,
      metadata
    };
  } catch (error) {
    console.error(`❌ Erreur lecture cache: ${error.message}`);
    return null;
  }
}

/**
 * Supprime un cache spécifique
 * @param {string} hash - Hash SHA-256 du fichier
 * @returns {boolean} true si supprimé avec succès
 */
function deleteCache(hash) {
  const jsonPath = path.join(CACHE_DIR, `${hash}.json`);
  const srtPath = path.join(CACHE_DIR, `${hash}.srt`);
  const metaPath = path.join(CACHE_DIR, `${hash}.meta.json`);
  
  let deleted = false;
  
  if (fs.existsSync(jsonPath)) {
    fs.unlinkSync(jsonPath);
    deleted = true;
  }
  
  if (fs.existsSync(srtPath)) {
    fs.unlinkSync(srtPath);
  }
  
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }
  
  if (deleted) {
    console.log(`🗑️  Cache supprimé: ${hash.substring(0, 12)}...`);
  }
  
  return deleted;
}

/**
 * Liste tous les caches disponibles
 * @returns {Array<Object>} Liste des caches avec métadonnées
 */
function listCaches() {
  initCacheDir();
  
  const files = fs.readdirSync(CACHE_DIR);
  const metaFiles = files.filter(f => f.endsWith('.meta.json'));
  
  const caches = metaFiles.map(metaFile => {
    const hash = metaFile.replace('.meta.json', '');
    const metaPath = path.join(CACHE_DIR, metaFile);
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    
    return {
      hash,
      ...metadata
    };
  });
  
  return caches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Nettoie les caches plus anciens qu'une certaine durée
 * @param {number} maxAgeDays - Âge maximum en jours
 * @returns {number} Nombre de caches supprimés
 */
function cleanOldCaches(maxAgeDays = 30) {
  const caches = listCaches();
  const now = new Date();
  let deletedCount = 0;
  
  caches.forEach(cache => {
    const cacheDate = new Date(cache.createdAt);
    const ageDays = (now - cacheDate) / (1000 * 60 * 60 * 24);
    
    if (ageDays > maxAgeDays) {
      deleteCache(cache.hash);
      deletedCount++;
    }
  });
  
  console.log(`🧹 ${deletedCount} cache(s) ancien(s) supprimé(s)`);
  return deletedCount;
}

/**
 * Obtient la taille totale du cache
 * @returns {Object} {totalSize, fileCount, formattedSize}
 */
function getCacheStats() {
  initCacheDir();
  
  const files = fs.readdirSync(CACHE_DIR);
  let totalSize = 0;
  
  files.forEach(file => {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
  });
  
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
  return {
    totalSize,
    fileCount: files.length,
    formattedSize: formatSize(totalSize),
    cacheCount: files.filter(f => f.endsWith('.json') && !f.endsWith('.meta.json')).length
  };
}

module.exports = {
  computeHash,
  isCached,
  saveCache,
  loadCache,
  deleteCache,
  listCaches,
  cleanOldCaches,
  getCacheStats,
  CACHE_DIR
};
