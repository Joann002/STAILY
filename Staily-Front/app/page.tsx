'use client';

import { useState } from 'react';

// Configuration de l'API backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [transcription, setTranscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Gestion de la sélection de fichier
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadedFile(null);
      setTranscription(null);
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

  // Transcription du fichier
  const handleTranscribe = async (filePath?: string) => {
    const pathToTranscribe = filePath || uploadedFile?.file?.relativePath;
    
    if (!pathToTranscribe) {
      alert('Aucun fichier à transcrire');
      return;
    }

    setTranscribing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: pathToTranscribe,
          modelSize: 'base',
          language: 'fr',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur transcription: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transcription réussie:', data);
      setTranscription(data);
      
    } catch (err: any) {
      console.error('Erreur transcription:', err);
      setError(err.message);
      alert(`Erreur lors de la transcription: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🎬 Transcription Audio/Vidéo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Uploadez une vidéo ou un fichier audio pour obtenir la transcription
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
            📤 Upload de fichier
          </h2>
          
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sélectionnez un fichier (.mp4, .mp3, .wav)
              </label>
              <input
                type="file"
                accept=".mp4,.mp3,.wav"
                onChange={handleFileChange}
                disabled={uploading || transcribing}
                className="block w-full text-sm text-gray-900 dark:text-gray-100 
                         border border-gray-300 dark:border-gray-600 rounded-lg 
                         cursor-pointer bg-gray-50 dark:bg-gray-700 
                         focus:outline-none p-2.5"
              />
            </div>

            {/* Selected File Info */}
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

            {/* Upload Button */}
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

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-800 dark:text-red-200">
              <strong>❌ Erreur:</strong> {error}
            </p>
          </div>
        )}

        {/* Video Player */}
        {uploadedFile && uploadedFile.file.mimetype === 'video/mp4' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
              🎥 Vidéo uploadée
            </h2>
            <video
              controls
              className="w-full rounded-lg"
              src={`${API_BASE_URL}${uploadedFile.file.relativePath}`}
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          </div>
        )}

        {/* Transcription Results */}
        {transcription && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
              📝 Transcription
            </h2>

            {/* Transcription Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Langue</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {transcription.transcription.language.toUpperCase()}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {(transcription.transcription.languageProbability * 100).toFixed(1)}% confiance
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Durée</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {transcription.transcription.duration}s
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Segments</p>
                <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                  {transcription.transcription.segments.length}
                </p>
              </div>
            </div>

            {/* Segments */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Segments de transcription:
              </h3>
              {transcription.transcription.segments.map((segment: any) => (
                <div
                  key={segment.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {segment.start.toFixed(2)}s → {segment.end.toFixed(2)}s
                    </span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      #{segment.id}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200">
                    {segment.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Performance Info */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ⏱️ Temps de traitement: <strong>{transcription.performance.totalTimeSeconds}s</strong>
              </p>
            </div>

            {/* Raw JSON (collapsible) */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600">
                🔍 Voir le JSON brut
              </summary>
              <pre className="mt-4 bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(transcription, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Instructions */}
        {!uploadedFile && !transcription && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              📖 Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>Sélectionnez un fichier vidéo (.mp4) ou audio (.mp3, .wav)</li>
              <li>Cliquez sur "Upload et Transcrire"</li>
              <li>Attendez l'extraction audio et la transcription</li>
              <li>Consultez les résultats avec timestamps</li>
            </ol>
            
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Note:</strong> Assurez-vous que le serveur backend est démarré sur le port 3001
              </p>
              <code className="text-xs text-yellow-700 dark:text-yellow-300 block mt-2">
                cd backend && npm run dev
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
