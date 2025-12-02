'use client';

import { useRef, useState, useEffect } from 'react';

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface AudioPlayerProps {
  audioUrl: string;
  segments: Segment[];
}

export default function AudioPlayer({ audioUrl, segments }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  // Mettre à jour le temps actuel
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  // Trouver le segment actif
  useEffect(() => {
    const active = segments.find(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );
    setActiveSegmentId(active?.id ?? null);
  }, [currentTime, segments]);

  // Sauter à un segment
  const jumpToSegment = (startTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
    }
  };

  // Formater le temps
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Lecteur audio */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                if (audioRef.current) {
                  if (isPlaying) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play();
                  }
                }
              }}
              className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <div>
              <div className="text-sm font-medium">🎵 Lecture audio</div>
              <div className="text-xs opacity-90">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          <div className="text-sm">
            {activeSegmentId !== null && (
              <span className="bg-white/20 px-3 py-1 rounded-full">
                Segment #{activeSegmentId}
              </span>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={(e) => {
              if (audioRef.current) {
                audioRef.current.currentTime = parseFloat(e.target.value);
              }
            }}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, white ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%)`
            }}
          />
        </div>

        {/* Audio element caché */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      </div>

      {/* Visualisation des segments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          📝 Transcription synchronisée
        </h3>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {segments.map((segment) => {
            const isActive = segment.id === activeSegmentId;
            
            return (
              <div
                key={segment.id}
                onClick={() => jumpToSegment(segment.start)}
                className={`
                  p-3 rounded-lg border-l-4 cursor-pointer transition-all
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md scale-[1.02]' 
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className={`text-xs font-mono ${isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {segment.start.toFixed(2)}s → {segment.end.toFixed(2)}s
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    #{segment.id}
                  </span>
                </div>
                <p className={`text-sm ${isActive ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  {segment.text}
                </p>
                {isActive && (
                  <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    En cours de lecture
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
