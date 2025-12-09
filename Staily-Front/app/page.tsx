'use client';

import { useState, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';

// Configuration de l'API backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [transcription, setTranscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [selectedModel, setSelectedModel] = useState<string>('large-v3');

  // Restaurer l'état depuis sessionStorage au chargement
  useEffect(() => {
    const savedTranscription = sessionStorage.getItem('transcription');
    const savedUploadedFile = sessionStorage.getItem('uploadedFile');

    if (savedTranscription && savedUploadedFile) {
      setTranscription(JSON.parse(savedTranscription));
      setUploadedFile(JSON.parse(savedUploadedFile));
      setHasUploaded(true);
    }
  }, []);

  // Gestion de la sélection de fichier
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadedFile(null);
      setTranscription(null);

      // Nettoyer les anciennes données de sessionStorage
      sessionStorage.removeItem('transcription');
      sessionStorage.removeItem('uploadedFile');
      sessionStorage.removeItem('transcriptionMetadata');
      sessionStorage.removeItem('correctedTranscription'); // ✅ Nettoyer l'ancienne correction GPT
    }
  };

  // Upload du fichier
  const handleUpload = async () => {
    if (!file) {
      alert('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erreur upload: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Upload réussi:', data);
      setUploadedFile(data);
      setHasUploaded(true); // ✅ Activer la vue 2 colonnes

      // Sauvegarder dans sessionStorage
      sessionStorage.setItem('uploadedFile', JSON.stringify(data));

      // Nettoyer l'ancienne correction GPT pour éviter qu'elle s'affiche avec la nouvelle vidéo
      sessionStorage.removeItem('correctedTranscription');

      // Lancer automatiquement la transcription
      await handleTranscribe(data.file.relativePath);

    } catch (err: any) {
      console.error('Erreur upload:', err);
      setError(err.message);
      alert(`Erreur lors de l'upload: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Transcription du fichier avec cache
  const handleTranscribe = async (filePath?: string) => {
    const pathToTranscribe = filePath || uploadedFile?.file?.relativePath;

    if (!pathToTranscribe) {
      alert('Aucun fichier à transcrire');
      return;
    }

    setTranscribing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/transcribe-robust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: pathToTranscribe,
          modelSize: selectedModel,
          language: selectedLanguage === 'auto' ? null : selectedLanguage,
          useCache: true,
          autoEnhance: true,
          useFallback: false,
          useGPTCorrection: false,
          saveSRT: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur transcription: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transcription réussie:', data);
      setTranscription(data);

      // Sauvegarder dans sessionStorage
      sessionStorage.setItem('transcription', JSON.stringify(data));

    } catch (err: any) {
      console.error('Erreur transcription:', err);
      setError(err.message);
      alert(`Erreur lors de la transcription: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  // Réinitialiser pour un nouvel upload
  const handleReset = () => {
    setFile(null);
    setHasUploaded(false);
    setUploadedFile(null);
    setTranscription(null);
    setError(null);

    // Nettoyer sessionStorage
    sessionStorage.removeItem('transcription');
    sessionStorage.removeItem('uploadedFile');
    sessionStorage.removeItem('transcriptionMetadata');
    sessionStorage.removeItem('correctedTranscription'); // ✅ Nettoyer l'ancienne correction GPT
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          🎬 Transcription Audio/Vidéo
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          {hasUploaded ? 'Votre transcription' : 'Uploadez une vidéo ou un fichier audio'}
        </p>
      </div>

      {/* 🔹 VUE AVANT UPLOAD : Interface simple centrée */}
      {!hasUploaded && (
        <div className="max-w-2xl mx-auto">{/* Upload Section */}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
              📤 Upload de fichier
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sélectionnez un fichier (.mp4, .mkv, .mp3, .wav)
                </label>
                <input
                  type="file"
                  accept=".mp4,.mkv,.mp3,.wav"
                  onChange={handleFileChange}
                  disabled={uploading || transcribing}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100 
                           border border-gray-300 dark:border-gray-600 rounded-lg 
                           cursor-pointer bg-gray-50 dark:bg-gray-700 
                           focus:outline-none p-2.5"
                />
              </div>

              {file && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Fichier sélectionné:</strong> {file.name}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    Taille: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🌍 Langue
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={uploading || transcribing}
                    className="block w-full text-sm text-gray-900 dark:text-gray-100 
                             border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-gray-50 dark:bg-gray-700 focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 p-2.5"
                  >
                    <option value="auto">Auto-détection</option>
                    <option value="fr">Français</option>
                    <option value="en">Anglais</option>
                    <option value="es">Espagnol</option>
                    <option value="de">Allemand</option>
                    <option value="it">Italien</option>
                    <option value="pt">Portugais</option>
                    <option value="nl">Néerlandais</option>
                    <option value="ru">Russe</option>
                    <option value="zh">Chinois</option>
                    <option value="ja">Japonais</option>
                    <option value="ar">Arabe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🤖 Modèle Whisper
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={uploading || transcribing}
                    className="block w-full text-sm text-gray-900 dark:text-gray-100 
                             border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-gray-50 dark:bg-gray-700 focus:outline-none 
                             focus:ring-2 focus:ring-blue-500 p-2.5"
                  >
                    <option value="tiny">Tiny (rapide)</option>
                    <option value="base">Base</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large-v3">Large-v3 (précis)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading || transcribing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                         text-white font-semibold py-3 px-6 rounded-lg 
                         transition-colors duration-200 disabled:cursor-not-allowed"
              >
                {uploading ? '⏳ Upload en cours...' :
                  transcribing ? '🎤 Transcription en cours...' :
                    '🚀 Upload et Transcrire'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-800 dark:text-red-200">
                <strong>❌ Erreur:</strong> {error}
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              📖 Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>Sélectionnez un fichier vidéo (.mp4, .mkv) ou audio (.mp3, .wav)</li>
              <li>Cliquez sur "Upload et Transcrire"</li>
              <li>Attendez la transcription (avec cache intelligent)</li>
              <li>Consultez les résultats avec timestamps</li>
            </ol>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💾 Cache intelligent:</strong> Si vous uploadez la même vidéo, la transcription sera instantanée !
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 VUE APRÈS UPLOAD : Layout 2 colonnes */}
      {hasUploaded && (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* COLONNE GAUCHE : Média + Transcription synchronisée */}
            <div className="space-y-6">
              {/* Lecteur Vidéo/Audio */}
              {uploadedFile && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {uploadedFile.file.mimetype === 'video/mp4' || uploadedFile.file.mimetype === 'video/x-matroska' ? '🎥 Vidéo' : '🎵 Audio'}
                    </h2>
                    <button
                      onClick={handleReset}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      ← Nouveau fichier
                    </button>
                  </div>

                  {/* Vidéo */}
                  {(uploadedFile.file.mimetype === 'video/mp4' || uploadedFile.file.mimetype === 'video/x-matroska') && (
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={`${API_BASE_URL}${uploadedFile.file.relativePath}`}
                    >
                      Votre navigateur ne supporte pas la lecture vidéo.
                    </video>
                  )}

                  {/* Audio simple (WAV) */}
                  {uploadedFile.file.mimetype === 'audio/wav' && (
                    <audio
                      controls
                      className="w-full"
                      src={`${API_BASE_URL}${uploadedFile.file.relativePath}`}
                    >
                      Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                  )}

                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Fichier:</strong> {uploadedFile.file.originalName}</p>
                    <p><strong>Taille:</strong> {uploadedFile.file.sizeInMB} MB</p>
                  </div>
                </div>
              )}

              {/* Lecteur audio avec transcription synchronisée pour MP3 */}
              {transcription && uploadedFile?.file?.mimetype === 'audio/mpeg' && transcription.raw?.segments && (
                <AudioPlayer
                  audioUrl={`${API_BASE_URL}${uploadedFile.file.relativePath}`}
                  segments={transcription.raw.segments}
                />
              )}
            </div>

            {/* COLONNE DROITE : Transcription complète */}
            <div className="space-y-6">
              {transcribing && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    🎤 Transcription en cours...
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-200">
                    <strong>❌ Erreur:</strong> {error}
                  </p>
                </div>
              )}

              {transcription && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                      📝 Transcription complète
                    </h2>
                    <button
                      onClick={() => {
                        // Sauvegarder les métadonnées dans sessionStorage
                        sessionStorage.setItem('transcriptionMetadata', JSON.stringify({
                          language: transcription.raw?.language,
                          duration: transcription.raw?.duration,
                          fileName: uploadedFile?.file?.originalName
                        }));
                        // Naviguer vers la page de texte
                        window.location.href = '/text-view';
                      }}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <span>Voir le texte complet</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Cache indicator */}
                  {transcription.fromCache && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        ⚡ <strong>Récupéré depuis le cache</strong> - Temps gagné: {transcription.cacheMetadata?.processingTime || 'N/A'}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Langue</p>
                      <p className="text-lg font-bold text-green-800 dark:text-green-200">
                        {transcription.raw?.language?.toUpperCase() || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Durée</p>
                      <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                        {transcription.raw?.duration?.toFixed(1) || 0}s
                      </p>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Segments</p>
                      <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                        {transcription.raw?.segments?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Segments scrollable */}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-800 py-2">
                      Tous les segments:
                    </h3>
                    {transcription.raw?.segments?.map((segment: any) => (
                      <div
                        key={segment.id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {segment.start?.toFixed(2)}s → {segment.end?.toFixed(2)}s
                          </span>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            #{segment.id}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Performance */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      ⏱️ Temps: <strong>{transcription.performance?.totalTimeSeconds}s</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
