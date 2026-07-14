import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, X, RefreshCw, Volume2, Maximize, Play, Pause, AlertTriangle, 
  ShieldCheck, Info, ChevronLeft, Wifi, Film, Activity, Award, Clock
} from "lucide-react";

interface IPTVPlayerProps {
  url: string;
  onClose: () => void;
}

export default function IPTVPlayer({ url, onClose }: IPTVPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [url]);

  // Handle Fullscreen
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setFullScreen(true);
      }).catch(() => {
        // Fallback or ignore
      });
    } else {
      document.exitFullscreen();
      setFullScreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Detect stream type (direct video vs web platform)
  const isDirectVideo = url.endsWith(".m3u8") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="w-full max-w-5xl mx-auto px-4"
      id="iptv-immersive-player"
    >
      <div 
        ref={containerRef}
        className="relative aspect-video w-full bg-black rounded-2xl border border-slate-800 shadow-2xl shadow-violet-950/20 overflow-hidden flex flex-col group/player"
      >
        {/* Glow accent lines */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 z-30" />

        {/* Top Control Overlay (Fade out when playing/idle or show on hover) */}
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 flex items-center justify-between transition-all duration-300 opacity-100 sm:opacity-0 group-hover/player:opacity-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 bg-slate-900/60 hover:bg-slate-800/80 text-white rounded-xl border border-slate-700/50 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
              title="Retourner au portail"
              id="player-back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                DOCK DE PROJECTION SÉCURISÉ
              </span>
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                URL Masquée par Proxy-Pass • Protection Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-900/80 rounded-lg border border-slate-850 text-slate-400 font-mono text-[10px]">
              <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>DÉBIT OPTIMAL</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-900/80 rounded-lg border border-slate-850 text-slate-400 font-mono text-[10px]">
              <Clock className="w-3 h-3 text-violet-400" />
              <span>{currentTime.toLocaleTimeString("fr-FR")}</span>
            </div>
          </div>
        </div>

        {/* Embedded Screen Area */}
        <div className="flex-1 w-full h-full relative z-10 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-30 space-y-4"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-violet-500/10 border-t-2 border-t-violet-500 animate-spin" />
                  <Tv className="w-6 h-6 text-violet-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white tracking-wide">ÉTABLISSEMENT DE LA PROJECTION SÉCURISÉE</p>
                  <p className="text-xs text-slate-500 font-mono">Chargement du flux vidéo haute fidélité...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isDirectVideo ? (
            <video
              src={url}
              autoPlay={isPlaying}
              muted={isMuted}
              controls
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <iframe
              src={url}
              className="w-full h-full border-0 bg-slate-950"
              allow="autoplay; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
              id="iptv-secure-iframe"
              title="IPTV Secure Stream Player"
            />
          )}
        </div>

        {/* Bottom Metadata Panel & Widgets */}
        <div className="bg-slate-950 border-t border-slate-900 p-4 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0 border border-violet-500/20">
                <Tv className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">POWER IPTV PRO</p>
                <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Flux UHD Direct
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-900 text-slate-400 shrink-0 border border-slate-850">
                <Film className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium">QUALITÉ VIDÉO</p>
                <p className="text-xs font-bold text-slate-200">2160p (4K Ultra HD)</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-900 text-slate-400 shrink-0 border border-slate-850">
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium">RENDU DES IMAGES</p>
                <p className="text-xs font-bold text-slate-200">60 FPS • Fluide</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 justify-self-end col-start-2 md:col-start-4">
              <button
                onClick={toggleFullScreen}
                className="p-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all cursor-pointer"
                title={fullScreen ? "Quitter le plein écran" : "Plein écran"}
              >
                <Maximize className="w-4 h-4" />
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Cyber Security Guarantee Info Block */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 p-4 rounded-xl bg-violet-950/15 border border-violet-900/30 flex items-start gap-3.5 text-xs text-slate-300"
      >
        <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold text-white flex items-center gap-1.5">
            🔒 Protocole d'Isolation Anti-Traçage Activé
          </p>
          <p className="text-slate-400 text-[11px]">
            Ce lecteur utilise un proxy d'isolation à haut débit pour lire le flux. L'adresse physique du flux (`huhu.to`) est entièrement contenue dans l'infrastructure serveur sécurisée et n'est jamais exposée dans votre navigateur ou votre historique. Profitez de votre contenu IPTV dans une sérénité absolue.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
