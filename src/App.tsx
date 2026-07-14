import React, { useState, useEffect } from "react";
import IPTVLogin from "./components/IPTVLogin";
import IPTVAdmin from "./components/IPTVAdmin";
import AnimatedPosterWall from "./components/AnimatedPosterWall";
import { Shield, Tv, Sparkles, Server } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname;
  });

  // Watch for history state changes or manual page changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const isAdminPage = currentPath.includes("/admin");

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-hidden selection:bg-violet-500/30 selection:text-white" id="main-app-container">
      {/* Immersive Cinematic Scrolling Poster Background for the Home Page */}
      {!isAdminPage && <AnimatedPosterWall />}

      {/* Decorative Cyberpunk Background Elements (shown on admin page or as fallback) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {/* Ambient violet and fuchsia glow nodes */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px), radial-gradient(#4f46e5 1px, #020617 1px)`,
            backgroundSize: "40px 40px",
            backgroundPosition: "0 0, 20px 20px"
          }}
        />
      </div>

      {/* Main Core Content wrapper */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4 relative z-10">
        
        {/* Header Title with animated glowing logo */}
        <div className="text-center mb-10 pointer-events-auto">
          {isAdminPage ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md mb-4 text-xs text-red-400 hover:text-white transition-colors cursor-pointer"
              onClick={() => navigateTo("/iptv")}
            >
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                Retour au Portail Client
              </span>
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 backdrop-blur-md mb-4 text-xs text-slate-400"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[10px] tracking-wider uppercase text-amber-400">
                Qualité UHD & 4K • Serveurs Premium Actifs
              </span>
            </motion.div>
          )}
          
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-3xl md:text-4xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center justify-center gap-3"
          >
            <Tv className="w-8 h-8 text-violet-500 animate-pulse shrink-0" />
            POWER IPTV <span className="text-xs font-mono font-medium tracking-normal text-amber-400 border border-amber-550/30 px-2 py-0.5 rounded bg-amber-500/10 self-center">ULTRA HD</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-sm text-slate-300 mt-2 max-w-md mx-auto"
          >
            Accédez à vos chaînes favorites, sports en direct et VOD en qualité exceptionnelle, sans coupure.
          </motion.p>
        </div>

        {/* Dynamic conditional render based on simulated path */}
        <div className="w-full flex justify-center">
          {isAdminPage ? (
            <IPTVAdmin onNavigateToLogin={() => navigateTo("/iptv")} />
          ) : (
            <IPTVLogin onNavigateToAdmin={() => navigateTo("/iptv/admin")} />
          )}
        </div>

      </main>

      {/* Footer copyright and diagnostics */}
      <footer className="py-6 border-t border-slate-900/80 bg-slate-950/40 backdrop-blur-md relative z-10 text-center text-xs text-slate-600" id="main-footer">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono">
            <Server className="w-3.5 h-3.5 text-slate-700" />
            <span>IPTV Gateway Proxy Core :</span>
            <span className="text-emerald-500 font-semibold">ACTIF (HTTPS)</span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} POWER IPTV • Service de Streaming Haute Stabilité & Qualité Premium
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-700 font-mono text-[10px]">CWD: CLOUD_RUN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
