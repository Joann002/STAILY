'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Configuration de l'API backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface CorrectedSegment {
  id: number;
  start: number;
  end: number;
  originalText: string;
  correctedText: string;
  changes: string[];
}

export default function TextView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [correctedSegments, setCorrectedSegments] = useState<CorrectedSegment[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCorrected, setShowCorrected] = useState(false);
  const [correctionSummary, setCorrectionSummary] = useState<string>('');
  const [correctionStats, setCorrectionStats] = useState<any>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Récupérer les données depuis sessionStorage
    const transcriptionData = sessionStorage.getItem('transcription');
    const metadataData = sessionStorage.getItem('transcriptionMetadata');
    const correctedData = sessionStorage.getItem('correctedTranscription');
    
    if (transcriptionData) {
      const data = JSON.parse(transcriptionData);
      setSegments(data.raw?.segments || []);
    }
    
    if (metadataData) {
      setMetadata(JSON.parse(metadataData));
    }
    
    // Charger les corrections GPT si elles existent déjà
    if (correctedData) {
      const corrected = JSON.parse(correctedData);
      setCorrectedSegments(corrected.segments);
      setCorrectionSummary(corrected.summary);
      setCorrectionStats(corrected.statistics);
      setShowCorrected(true);
    }
  }, []);
  
  // Auto-hide notification après 5 secondes
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleBack = () => {
    // Retourner à la page principale avec l'état de transcription
    router.push('/');
  };

  const handleApplyRules = async () => {
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/apply-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segments: segments,
          language: metadata?.language || 'fr',
          context: '',
          saveSRT: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Règles appliquées:', data);
      
      setCorrectedSegments(data.corrected.segments);
      setCorrectionSummary(data.summary);
      setCorrectionStats(data.statistics);
      setShowCorrected(true);
      
      // Sauvegarder dans sessionStorage pour réutilisation
      sessionStorage.setItem('correctedTranscription', JSON.stringify({
        segments: data.corrected.segments,
        summary: data.summary,
        statistics: data.statistics,
        timestamp: Date.now()
      }));
      
      // Afficher notification de succès
      setNotification({
        message: 'Règles de verbatim corrigé appliquées avec succès !',
        type: 'success'
      });
      
    } catch (error: any) {
      console.error('Erreur application règles:', error);
      setNotification({
        message: `❌ Erreur: ${error.message}`,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = () => {
    const textToUse = showCorrected && correctedSegments 
      ? correctedSegments.map(seg => seg.correctedText).join('\n')
      : segments.map(seg => seg.text).join('\n');
    
    navigator.clipboard.writeText(textToUse);
    alert('✅ Texte copié dans le presse-papier !');
  };

  const handleDownloadText = () => {
    const textToUse = showCorrected && correctedSegments 
      ? correctedSegments.map(seg => seg.correctedText).join('\n')
      : segments.map(seg => seg.text).join('\n');
    
    const blob = new Blob([textToUse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${showCorrected ? 'corrigee' : 'brute'}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (segments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ❌ Aucune transcription disponible
          </h1>
          <button
            onClick={handleBack}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <span className="text-lg">
              {notification.type === 'success' ? '✅' : '❌'}
            </span>
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header avec navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Retour</span>
            </button>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {showCorrected ? '✨ Texte corrigé' : '📄 Texte brut'}
            </h1>

            <div className="flex space-x-2">
              <button
                onClick={handleCopyText}
                className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors"
                title="Copier le texte"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Copier</span>
              </button>

              <button
                onClick={handleDownloadText}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                title="Télécharger le texte"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Télécharger</span>
              </button>
            </div>
          </div>

          {/* Métadonnées */}
          {metadata && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Langue</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                  {metadata.language?.toUpperCase() || 'N/A'}
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Durée</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                  {metadata.duration?.toFixed(1) || 0}s
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Lignes</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                  {segments.length}
                </p>
              </div>
            </div>
          )}

          {/* Bouton pour appliquer les règles GPT */}
          {!correctedSegments && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1">
                    🧠 Verbatim Corrigé avec GPT-4o-mini
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Appliquer les règles professionnelles : suppression hésitations, correction grammaire, ponctuation optimale
                  </p>
                </div>
                <button
                  onClick={handleApplyRules}
                  disabled={isProcessing}
                  className="ml-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isProcessing ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Traitement...</span>
                    </span>
                  ) : (
                    '✨ Appliquer les règles'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Toggle entre brut et corrigé */}
          {correctedSegments && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                    ✅ Règles appliquées avec succès !
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {correctionSummary}
                  </p>
                  {correctionStats && (
                    <div className="mt-2 flex space-x-4 text-xs text-green-600 dark:text-green-400">
                      <span>📝 {correctionStats.segmentsModified}/{correctionStats.totalSegments} segments modifiés</span>
                      <span>🗑️ {correctionStats.hesitationsRemoved} hésitations supprimées</span>
                      <span>✏️ {correctionStats.grammarFixed} corrections grammaticales</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowCorrected(!showCorrected)}
                  className="ml-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {showCorrected ? '📄 Voir brut' : '✨ Voir corrigé'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Texte complet */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="prose dark:prose-invert max-w-none">
            {!showCorrected ? (
              // Texte brut
              <div className="space-y-4 text-gray-800 dark:text-gray-200 leading-relaxed">
                {segments.map((segment, index) => (
                  <p key={segment.id} className="text-base">
                    {segment.text}
                  </p>
                ))}
              </div>
            ) : (
              // Texte corrigé avec comparaison
              <div className="space-y-6">
                {correctedSegments?.map((segment, index) => (
                  <div key={segment.id} className="border-l-4 border-green-500 pl-4">
                    <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
                      {segment.correctedText}
                    </p>
                    {segment.changes && segment.changes.length > 0 && (
                      <details className="text-xs text-gray-500 dark:text-gray-400">
                        <summary className="cursor-pointer hover:text-green-600 dark:hover:text-green-400">
                          🔍 Voir les modifications ({segment.changes.length})
                        </summary>
                        <div className="mt-2 space-y-1 pl-4">
                          <p className="text-gray-400 dark:text-gray-500 italic">Original: {segment.originalText}</p>
                          {segment.changes.map((change, idx) => (
                            <p key={idx} className="text-green-600 dark:text-green-400">• {change}</p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats en bas */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                📊 {showCorrected && correctedSegments ? correctedSegments.length : segments.length} lignes • {
                  showCorrected && correctedSegments 
                    ? correctedSegments.map(s => s.correctedText).join(' ').split(' ').length
                    : segments.map(s => s.text).join(' ').split(' ').length
                } mots
              </span>
              <span>
                📝 {
                  showCorrected && correctedSegments 
                    ? correctedSegments.map(s => s.correctedText).join('').length
                    : segments.map(s => s.text).join('').length
                } caractères
              </span>
            </div>
          </div>
        </div>

        {/* Bouton retour en bas */}
        <div className="mt-6 text-center">
          <button
            onClick={handleBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            ← Retour à la transcription
          </button>
        </div>
      </div>
    </div>
  );
}
