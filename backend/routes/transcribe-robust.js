/**
 * Route de transcription robuste avec gestion intelligente de la qualité audio
 * Utilise l'orchestrateur Whisper pour gérer automatiquement les problèmes audio
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../scripts/extractAudio');
const { orchestrateTranscription } = require('../services/whisperOrchestrator');
const { applyRulesToTranscription, generateCleanedText } = require('../services/applyRules');
const { generateSRTFile } = require('../services/gptFormatter');
const { computeHash, isCached, saveCache, loadCache } = require('../services/cacheManager');

const router = express.Router();

// Charger les variables d'environnement
require('dotenv').config();

/**
 * POST /transcribe-robust
 * Pipeline robuste de transcription avec gestion automatique de la qualité
 * 
 * Body JSON:
 * {
 *   "filePath": "uploads/video-123456.mp4",
 *   "modelSize": "base",              // optionnel: tiny, base, small, medium, large-v3
 *   "language": "fr",                  // optionnel: fr, en, etc. (null = auto)
 *   "autoEnhance": true,               // optionnel: amélioration audio auto (défaut: true)
 *   "useFallback": true,               // optionnel: utiliser les fallbacks (défaut: true)
 *   "useGPTCorrection": true,          // optionnel: correction GPT si qualité faible (défaut: true)
 *   "saveSRT": true,                   // optionnel: sauvegarder le fichier .srt (défaut: true)
 *   "useCache": true                   // optionnel: utiliser le cache intelligent (défaut: true)
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      filePath, 
      modelSize = 'large-v3', 
      language = null,
      autoEnhance = true,
      useFallback = true,
      useGPTCorrection = false, // ⚠️ GPT désactivé
      saveSRT = true,
      useCache = true
    } = req.body;
    
    console.log('\n🚀 === PIPELINE ROBUSTE DE TRANSCRIPTION ===');
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`🤖 Modèle Whisper: ${modelSize}`);
    console.log(`🌍 Langue: ${language || 'auto-détection'}`);
    console.log(`🔧 Amélioration auto: ${autoEnhance ? 'OUI' : 'NON'}`);
    console.log(`🔄 Fallbacks: ${useFallback ? 'OUI' : 'NON'}`);
    console.log(`🧠 Correction GPT: ${useGPTCorrection ? 'OUI' : 'NON'}`);
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
                cleanedSegmentCount: cached.transcription.cleaned?.segments?.length || 0
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
    console.log('\n📍 ÉTAPE 1: Extraction audio...');
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
    
    // ÉTAPE 2: Orchestration intelligente de la transcription
    console.log('\n📍 ÉTAPE 2: Orchestration intelligente...');
    
    const orchestrationResult = await orchestrateTranscription(audioPath, {
      modelSize,
      language,
      autoEnhance,
      useFallback,
      useGPTCorrection,
      openaiApiKey: process.env.OPENAI_API_KEY,
      fileHash  // Passer le hash du fichier pour un cache GPT unique par vidéo
    });
    
    // Vérifier si la transcription a réussi
    if (!orchestrationResult.success || !orchestrationResult.transcription) {
      return res.status(500).json({
        success: false,
        error: 'Échec de la transcription',
        userMessage: orchestrationResult.userMessage,
        audioQuality: orchestrationResult.audioQuality,
        warnings: orchestrationResult.warnings
      });
    }
    
    // ÉTAPE 3: Nettoyage local (règles)
    console.log('\n📍 ÉTAPE 3: Nettoyage local (règles)...');
    const cleanedSegments = applyRulesToTranscription(orchestrationResult.transcription.segments);
    const cleanedText = generateCleanedText(cleanedSegments);
    console.log(`✅ Segments nettoyés`);
    
    // ÉTAPE 4: Génération du SRT
    let srtContent = null;
    let srtPath = null;
    
    if (saveSRT) {
      console.log('\n📍 ÉTAPE 4: Génération du fichier SRT...');
      
      // Utiliser le SRT de GPT si disponible, sinon générer depuis les segments nettoyés
      if (orchestrationResult.gptCorrection && orchestrationResult.gptCorrection.srt) {
        srtContent = generateSRTFile(orchestrationResult.gptCorrection.srt);
        console.log('✅ SRT généré depuis la correction GPT');
      } else {
        // Générer un SRT simple depuis les segments nettoyés
        const srtData = cleanedSegments.map((seg, index) => ({
          index: index + 1,
          start: secondsToSRT(seg.start),
          end: secondsToSRT(seg.end),
          text: seg.text
        }));
        srtContent = generateSRTFile(srtData);
        console.log('✅ SRT généré depuis les segments nettoyés');
      }
      
      // Sauvegarder le fichier SRT
      const baseName = path.basename(orchestrationResult.finalAudioPath, path.extname(orchestrationResult.finalAudioPath));
      srtPath = path.join(path.dirname(orchestrationResult.finalAudioPath), `${baseName}.srt`);
      fs.writeFileSync(srtPath, srtContent);
      console.log(`💾 Fichier SRT sauvegardé: ${srtPath}`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ === PIPELINE TERMINÉ EN ${totalTime}s ===\n`);
    
    // Préparer la réponse complète
    const responseData = {
      success: true,
      message: 'Pipeline robuste de transcription terminé',
      fromCache: false,
      userMessage: orchestrationResult.userMessage,
      input: {
        originalFile: filePath,
        audioFile: path.relative(path.join(__dirname, '..'), audioPath),
        finalAudioFile: path.relative(path.join(__dirname, '..'), orchestrationResult.finalAudioPath),
        modelSize,
        language: orchestrationResult.transcription.language
      },
      quality: {
        audio: {
          level: orchestrationResult.audioQuality.qualityLevel,
          score: orchestrationResult.audioQuality.qualityScore,
          issues: orchestrationResult.audioQuality.issues
        },
        transcription: {
          level: orchestrationResult.transcriptionQuality.qualityLevel,
          score: orchestrationResult.transcriptionQuality.qualityScore,
          issues: orchestrationResult.transcriptionQuality.issues
        }
      },
      enhancement: orchestrationResult.enhancement ? {
        applied: true,
        preset: orchestrationResult.enhancement.preset,
        originalQualityScore: orchestrationResult.enhancement.originalQualityScore
      } : {
        applied: false
      },
      fallback: orchestrationResult.fallback,
      raw: {
        text: orchestrationResult.transcription.text,
        segments: orchestrationResult.transcription.segments,
        duration: orchestrationResult.transcription.duration,
        languageProbability: orchestrationResult.transcription.language_probability
      },
      cleaned: {
        text: cleanedText,
        segments: cleanedSegments
      },
      formatted: orchestrationResult.gptCorrection ? {
        summary: orchestrationResult.gptCorrection.summary,
        srt: orchestrationResult.gptCorrection.srt,
        srtFile: srtContent,
        srtPath: srtPath ? path.relative(path.join(__dirname, '..'), srtPath) : null
      } : {
        srtFile: srtContent,
        srtPath: srtPath ? path.relative(path.join(__dirname, '..'), srtPath) : null
      },
      warnings: orchestrationResult.warnings,
      performance: {
        totalTimeSeconds: totalTime,
        rawSegmentCount: orchestrationResult.transcription.segments.length,
        cleanedSegmentCount: cleanedSegments.length
      }
    };
    
    // Sauvegarder dans le cache si activé
    if (useCache && fileHash) {
      try {
        console.log('💾 Sauvegarde dans le cache...');
        saveCache(
          fileHash,
          {
            userMessage: responseData.userMessage,
            input: responseData.input,
            quality: responseData.quality,
            enhancement: responseData.enhancement,
            fallback: responseData.fallback,
            raw: responseData.raw,
            cleaned: responseData.cleaned,
            formatted: responseData.formatted,
            warnings: responseData.warnings
          },
          srtContent,
          {
            modelSize,
            language: orchestrationResult.transcription.language,
            processingTime: `${totalTime}s`,
            originalFile: filePath,
            autoEnhance,
            useFallback,
            useGPTCorrection,
            segmentCount: orchestrationResult.transcription.segments.length,
            audioQualityLevel: orchestrationResult.audioQuality.qualityLevel,
            transcriptionQualityLevel: orchestrationResult.transcriptionQuality.qualityLevel
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

/**
 * Convertit les secondes en format SRT (HH:MM:SS,mmm)
 * @param {number} seconds - Temps en secondes
 * @returns {string} Format SRT
 */
function secondsToSRT(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

module.exports = router;
