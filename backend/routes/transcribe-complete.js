/**
 * Route de transcription complète avec nettoyage et formatage GPT
 * Pipeline: Upload → Extraction audio → Whisper → Nettoyage local → Formatage GPT → SRT
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../scripts/extractAudio');
const { transcribeAudio } = require('../scripts/transcribeAudio');
const { applyRulesToTranscription, generateCleanedText } = require('../services/applyRules');
// const { formatWithGPT, generateSRTFile } = require('./gptFormatter'); // ⚠️ GPT supprimé
const { computeHash, isCached, saveCache, loadCache } = require('../services/cacheManager');

const router = express.Router();

// Charger les variables d'environnement
require('dotenv').config();

/**
 * POST /transcribe-complete
 * Pipeline complet de transcription avec nettoyage et formatage
 * 
 * Body JSON:
 * {
 *   "filePath": "uploads/video-123456.mp4",
 *   "modelSize": "base",           // optionnel: tiny, base, small, medium, large-v3
 *   "language": "fr",               // optionnel: fr, en, etc. (null = auto)
 *   "useGPT": true,                 // optionnel: utiliser GPT pour formatage (défaut: true)
 *   "saveSRT": true                 // optionnel: sauvegarder le fichier .srt (défaut: true)
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      filePath, 
      modelSize = 'large-v3', 
      language = null,
      useGPT = true,
      saveSRT = true,
      useCache = true  // Nouveau paramètre pour activer/désactiver le cache
    } = req.body;
    
    console.log('\n🚀 === PIPELINE COMPLET DE TRANSCRIPTION ===');
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`🤖 Modèle Whisper: ${modelSize}`);
    console.log(`🌍 Langue: ${language || 'auto-détection'}`);
    console.log(`🧠 Formatage GPT: ${useGPT ? 'OUI' : 'NON'}`);
    console.log(`💾 Cache: ${useCache ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    
    // Validation
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "filePath" est requis'
      });
    }
    
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: `Fichier introuvable: ${filePath}`
      });
    }
    
    // ÉTAPE 0: Vérifier le cache
    let fileHash = null;
    let fromCache = false;
    
    if (useCache) {
      console.log('\n📍 ÉTAPE 0: Vérification du cache...');
      try {
        fileHash = await computeHash(fullPath);
        console.log(`🔑 Hash du fichier: ${fileHash.substring(0, 12)}...`);
        
        if (isCached(fileHash)) {
          console.log('✅ Cache trouvé ! Chargement...');
          const cached = loadCache(fileHash);
          
          if (cached) {
            const cacheAge = cached.metadata.createdAt 
              ? `(créé le ${new Date(cached.metadata.createdAt).toLocaleString('fr-FR')})`
              : '';
            
            console.log(`⚡ Transcription récupérée depuis le cache ${cacheAge}`);
            console.log(`⏱️  Temps gagné: ~${cached.metadata.processingTime || 'inconnu'}`);
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
            
            return res.status(200).json({
              success: true,
              message: 'Transcription récupérée depuis le cache',
              fromCache: true,
              cacheMetadata: cached.metadata,
              ...cached.transcription,
              performance: {
                totalTimeSeconds: totalTime,
                savedTime: cached.metadata.processingTime,
                rawSegmentCount: cached.transcription.raw?.segments?.length || 0,
                formattedSubtitleCount: cached.transcription.formatted?.srt?.length || 0
              }
            });
          }
        } else {
          console.log('❌ Aucun cache trouvé, traitement complet nécessaire');
        }
      } catch (hashError) {
        console.error(`⚠️  Erreur calcul hash: ${hashError.message}`);
        console.log('   → Continuation sans cache');
      }
    }
    
    // ÉTAPE 1: Extraction audio (si nécessaire)
    console.log('\n📍 ÉTAPE 1/4: Extraction audio...');
    const ext = path.extname(filePath).toLowerCase();
    let audioPath;
    
    if (ext === '.mp4' || ext === '.mkv') {
      audioPath = await extractAudio(fullPath);
      console.log(`✅ Audio extrait: ${audioPath}`);
    } else if (['.mp3', '.wav'].includes(ext)) {
      audioPath = fullPath;
      console.log('✅ Fichier audio déjà prêt');
    } else {
      return res.status(400).json({
        success: false,
        error: `Format non supporté: ${ext}`
      });
    }
    
    // ÉTAPE 2: Transcription Whisper
    console.log('\n📍 ÉTAPE 2/4: Transcription Whisper...');
    const rawTranscription = await transcribeAudio(audioPath, modelSize, language);
    console.log(`✅ Transcription brute: ${rawTranscription.segments.length} segments`);
    
    // ÉTAPE 3: Nettoyage local (règles)
    console.log('\n📍 ÉTAPE 3/4: Nettoyage local (règles)...');
    const cleanedSegments = applyRulesToTranscription(rawTranscription.segments);
    const cleanedText = generateCleanedText(cleanedSegments);
    console.log(`✅ Segments nettoyés: suppression filler words, corrections casse`);
    
    // ÉTAPE 4: Formatage GPT (DÉSACTIVÉ)
    let gptResult = null;
    let srtContent = null;
    
    console.log('\n📍 ÉTAPE 4/4: Formatage GPT désactivé (fonctionnalité supprimée)');
    
    // Sauvegarder le fichier SRT
    let srtPath = null;
    if (saveSRT && srtContent) {
      const baseName = path.basename(audioPath, path.extname(audioPath));
      srtPath = path.join(path.dirname(audioPath), `${baseName}.srt`);
      fs.writeFileSync(srtPath, srtContent);
      console.log(`💾 Fichier SRT sauvegardé: ${srtPath}`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ === PIPELINE TERMINÉ EN ${totalTime}s ===\n`);
    
    // Préparer la réponse complète
    const responseData = {
      success: true,
      message: 'Pipeline de transcription terminé',
      fromCache: false,
      input: {
        originalFile: filePath,
        audioFile: path.relative(path.join(__dirname, '..'), audioPath),
        modelSize,
        language: rawTranscription.language
      },
      raw: {
        text: rawTranscription.text,
        segments: rawTranscription.segments,
        duration: rawTranscription.duration,
        languageProbability: rawTranscription.language_probability
      },
      cleaned: {
        text: cleanedText,
        segments: cleanedSegments
      },
      formatted: gptResult ? {
        summary: gptResult.summary,
        srt: gptResult.srt,
        srtFile: srtContent,
        srtPath: srtPath ? path.relative(path.join(__dirname, '..'), srtPath) : null
      } : null,
      performance: {
        totalTimeSeconds: totalTime,
        rawSegmentCount: rawTranscription.segments.length,
        formattedSubtitleCount: gptResult ? gptResult.srt.length : null
      }
    };
    
    // Sauvegarder dans le cache si activé
    if (useCache && fileHash) {
      try {
        console.log('💾 Sauvegarde dans le cache...');
        saveCache(
          fileHash,
          {
            input: responseData.input,
            raw: responseData.raw,
            cleaned: responseData.cleaned,
            formatted: responseData.formatted
          },
          srtContent,
          {
            modelSize,
            language: rawTranscription.language,
            processingTime: `${totalTime}s`,
            originalFile: filePath,
            useGPT,
            segmentCount: rawTranscription.segments.length
          }
        );
        console.log('✅ Cache sauvegardé avec succès');
      } catch (cacheError) {
        console.error(`⚠️  Erreur sauvegarde cache: ${cacheError.message}`);
      }
    }
    
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('\n❌ === ERREUR PIPELINE ===');
    console.error(error);
    console.error('===========================\n');
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors du pipeline de transcription',
      details: error.message
    });
  }
});

module.exports = router;
