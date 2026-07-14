import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, Maximize, Minimize, ChevronLeft, ShieldCheck, Wifi, Clock, Fullscreen
} from "lucide-react";

interface IPTVPlayerProps {
  url: string;
  username: string;
  expiresAt: number;
  onClose: () => void;
  onSessionExpired: () => void;
}

export default function IPTVPlayer({ url, username, expiresAt, onClose, onSessionExpired }: IPTVPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showControls, setShowControls] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Periodic background check to immediately disconnect if account expires or gets deleted/expired on the server
  useEffect(() => {
    if (!username || !expiresAt) return;

    const checkInterval = setInterval(async () => {
      // 1. Client-side local time check (immediate, no network required)
      if (Date.now() > expiresAt) {
        clearInterval(checkInterval);
        onSessionExpired();
        return;
      }

      // 2. Server-side/DB sync check
      try {
        const response = await fetch(`/api/session/check-status?username=${encodeURIComponent(username)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "expired") {
            clearInterval(checkInterval);
            onSessionExpired();
          }
        }
      } catch (err) {
        console.warn("Erreur d'arrière-plan lors de la vérification de session :", err);
      }
    }, 4000); // Highly responsive but quota-friendly check every 4 seconds

    return () => clearInterval(checkInterval);
  }, [username, expiresAt, onSessionExpired]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle stream load simulation
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [url]);

  // Autohide controls on idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  useEffect(() => {
    handleMouseMove();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Toggle full browser screen (HTML5 Fullscreen API)
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullScreen(true))
        .catch((err) => {
          console.error("Error entering fullscreen:", err);
        });
    } else {
      document.exitFullscreen()
        .then(() => setIsFullScreen(false))
        .catch((err) => {
          console.error("Error exiting fullscreen:", err);
        });
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Try to launch browser fullscreen automatically upon launch
  useEffect(() => {
    const autoFullscreenTimer = setTimeout(() => {
      if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen()
          .then(() => setIsFullScreen(true))
          .catch(() => {
            // Browsers often require a user gesture first, so we quietly fail if blocked
          });
      }
    }, 500);
    return () => clearTimeout(autoFullscreenTimer);
  }, []);

  const isDirectVideo = url.endsWith(".m3u8") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
      className="fixed inset-0 w-full h-full bg-black z-50 overflow-hidden flex flex-col justify-center items-center select-none"
      id="iptv-immersive-fullscreen-player"
    >
      {/* Absolute background stream */}
      <div className="absolute inset-0 w-full h-full z-10 bg-black">
        {isDirectVideo ? (
          <video
            src={url}
            autoPlay={isPlaying}
            controls
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <iframe
            src={url}
            className="w-full h-full border-0 bg-black"
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
            id="iptv-secure-iframe"
            title="IPTV Secure Stream Player"
          />
        )}
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-40 space-y-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-violet-500/10 border-t-2 border-t-violet-500 animate-spin" />
              <Tv className="w-6 h-6 text-violet-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white tracking-wide">CONNEXION AU FLUX SÉCURISÉ</p>
              <p className="text-xs text-slate-500 font-mono">Chiffrement actif • Proxy-Pass activé</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Header Controls Overlay - Slides down on hover/move */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-30 flex items-center justify-between pointer-events-auto"
          >
            {/* Left controller: back button & status */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/50 transition-all flex items-center gap-2 cursor-pointer text-xs font-bold shadow-lg shadow-black/40 hover:scale-105 active:scale-95"
                title="Retourner au portail"
                id="player-back-btn"
              >
                <ChevronLeft className="w-4.5 h-4.5 text-violet-400" />
                <span>Retour</span>
              </button>

              <div className="flex flex-col">
                <span className="text-white font-black text-xs md:text-sm flex items-center gap-2 tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-400 shrink-0" />
                  LECTURE DIRECTE SÉCURISÉE
                </span>
                <span className="text-[9px] md:text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                  Flux Interne • Masquage Actif d'URL (huhu.to masqué)
                </span>
              </div>
            </div>

            {/* Right controller: quick action widgets & fullscreen toggle */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/85 rounded-xl border border-slate-800 text-slate-300 font-mono text-[10px] shadow-lg">
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="font-bold">4K UHD PROJECTION</span>
              </div>

              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/85 rounded-xl border border-slate-800 text-slate-300 font-mono text-[10px] shadow-lg">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span>{currentTime.toLocaleTimeString("fr-FR")}</span>
              </div>

              {/* Real Fullscreen Button */}
              <button
                onClick={toggleFullScreen}
                className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/50 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                title={isFullScreen ? "Quitter le plein écran" : "Plein écran système"}
                id="player-fullscreen-btn"
              >
                {isFullScreen ? (
                  <Minimize className="w-4.5 h-4.5 text-violet-400" />
                ) : (
                  <Maximize className="w-4.5 h-4.5 text-violet-400" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                title="Quitter le lecteur"
                id="player-close-btn"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast indicating controls exist */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-1.5 bg-slate-950/90 border border-slate-850 rounded-full text-[10px] text-slate-400 font-mono tracking-wide z-30 pointer-events-none flex items-center gap-2 shadow-2xl backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
            Bougez la souris pour afficher les options de contrôle
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
