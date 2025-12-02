/**
 * Route de transcription complète
 * Orchestre : extraction audio → transcription Whisper → retour JSON
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../scripts/extractAudio');
const { transcribeAudio } = require('../scripts/transcribeAudio');

const router = express.Router();

/**
 * POST /transcribe
 * Reçoit le chemin d'un fichier uploadé, extrait l'audio et le transcrit
 * 
 * Body JSON attendu:
 * {
 *   "filePath": "uploads/video-123456.mp4",
 *   "modelSize": "base",  // optionnel: tiny, base, small, medium, large-v3
 *   "language": "fr"      // optionnel: fr, en, es, etc. (null = auto-détection)
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 1. Récupérer les paramètres
    const { filePath, modelSize = 'large-v3', language = null } = req.body;
    
    console.log('\n🎬 === DÉBUT TRANSCRIPTION ===');
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`🤖 Modèle: ${modelSize}`);
    console.log(`🌍 Langue: ${language || 'auto-détection'}`);
    
    // 2. Valider les paramètres
    if (!filePath) {
      console.log('❌ Erreur: filePath manquant');
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "filePath" est requis'
      });
    }
    
    // 3. Vérifier que le fichier existe
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ Erreur: Fichier introuvable: ${fullPath}`);
      return res.status(404).json({
        success: false,
        error: `Fichier introuvable: ${filePath}`
      });
    }
    
    console.log(`✅ Fichier trouvé: ${fullPath}`);
    
    // 4. Déterminer si extraction audio nécessaire
    const ext = path.extname(filePath).toLowerCase();
    let audioPath;
    
    if (ext === '.mp4' || ext === '.mkv') {
      // Extraction audio nécessaire pour les vidéos
      console.log('\n🎵 ÉTAPE 1/2: Extraction audio...');
      try {
        audioPath = await extractAudio(fullPath);
        const extractTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Audio extrait en ${extractTime}s: ${audioPath}`);
      } catch (extractError) {
        console.error(`❌ Erreur extraction audio: ${extractError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Échec de l\'extraction audio',
          details: extractError.message
        });
      }
    } else if (['.mp3', '.wav'].includes(ext)) {
      // Fichier audio déjà prêt
      audioPath = fullPath;
      console.log('✅ Fichier audio déjà au bon format');
    } else {
      console.log(`❌ Format non supporté: ${ext}`);
      return res.status(400).json({
        success: false,
        error: `Format de fichier non supporté: ${ext}. Formats acceptés: .mp4, .mkv, .mp3, .wav`
      });
    }
    
    // 5. Transcription avec Whisper
    console.log('\n🎤 ÉTAPE 2/2: Transcription Whisper...');
    let transcription;
    
    try {
      transcription = await transcribeAudio(audioPath, modelSize, language);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Transcription terminée en ${totalTime}s`);
      console.log(`   - Langue: ${transcription.language} (${(transcription.language_probability * 100).toFixed(1)}%)`);
      console.log(`   - Durée audio: ${transcription.duration}s`);
      console.log(`   - Segments: ${transcription.segments.length}`);
      console.log(`   - JSON sauvegardé: ${transcription.jsonPath}`);
      
    } catch (transcribeError) {
      console.error(`❌ Erreur transcription: ${transcribeError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Échec de la transcription',
        details: transcribeError.message
      });
    }
    
    // 6. Préparer la réponse
    const response = {
      success: true,
      message: 'Transcription réussie',
      input: {
        originalFile: filePath,
        audioFile: path.relative(path.join(__dirname, '..'), audioPath),
        modelSize: modelSize,
        requestedLanguage: language
      },
      transcription: {
        language: transcription.language,
        languageProbability: transcription.language_probability,
        duration: transcription.duration,
        segments: transcription.segments,
        jsonPath: path.relative(path.join(__dirname, '..'), transcription.jsonPath)
      },
      performance: {
        totalTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
        segmentCount: transcription.segments.length
      }
    };
    
    console.log('\n✅ === TRANSCRIPTION TERMINÉE ===\n');
    
    // 7. Retourner le résultat
    res.status(200).json(response);
    
  } catch (error) {
    console.error('\n❌ === ERREUR TRANSCRIPTION ===');
    console.error(error);
    console.error('=================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la transcription',
      details: error.message
    });
  }
});

/**
 * GET /transcribe/status
 * Vérifie que tous les prérequis sont installés
 */
router.get('/status', (req, res) => {
  const checks = {
    ffmpeg: false,
    pythonVenv: false,
    fasterWhisper: false
  };
  
  // Vérifier FFmpeg
  const { execSync } = require('child_process');
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    checks.ffmpeg = true;
  } catch (e) {
    checks.ffmpeg = false;
  }
  
  // Vérifier l'environnement virtuel Python
  const venvPath = path.join(__dirname, '../venv/bin/python');
  checks.pythonVenv = fs.existsSync(venvPath);
  
  // Vérifier faster-whisper
  if (checks.pythonVenv) {
    try {
      execSync(`${venvPath} -c "import faster_whisper"`, { stdio: 'ignore' });
      checks.fasterWhisper = true;
    } catch (e) {
      checks.fasterWhisper = false;
    }
  }
  
  const allReady = checks.ffmpeg && checks.pythonVenv && checks.fasterWhisper;
  
  res.json({
    ready: allReady,
    checks: checks,
    message: allReady 
      ? '✅ Tous les prérequis sont installés'
      : '⚠️ Certains prérequis manquent',
    instructions: !allReady ? {
      ffmpeg: !checks.ffmpeg ? 'sudo apt install ffmpeg -y' : null,
      python: !checks.pythonVenv ? 'cd backend && python3 -m venv venv' : null,
      whisper: !checks.fasterWhisper ? 'cd backend && ./venv/bin/pip install faster-whisper' : null
    } : null
  });
});

module.exports = router;
