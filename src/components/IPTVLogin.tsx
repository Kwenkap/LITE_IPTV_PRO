import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Tv2, Lock, User, AlertTriangle, RefreshCw, Play, 
  ShoppingCart, Sparkles, ArrowRight, ShieldCheck, Compass 
} from "lucide-react";
import FAQSection from "./FAQSection";

interface IPTVLoginProps {
  onNavigateToAdmin: () => void;
  onPlayStream: (url: string) => void;
}

export default function IPTVLogin({ onNavigateToAdmin, onPlayStream }: IPTVLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Veuillez saisir votre nom d'utilisateur et votre mot de passe.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de la connexion.");
      }

      if (data.isAdmin) {
        localStorage.setItem("iptv_admin_token", data.adminToken);
        onNavigateToAdmin();
        return;
      }

      setIsRedirecting(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsRedirecting(false);
        onPlayStream(data.url);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Impossible de se connecter au serveur.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl px-4" id="iptv-login-container">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* BLOCK 1: Connection / Login Form - SHOWN FIRST ON MOBILE (order-1) */}
        <div className="order-1 lg:order-2 lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-end-3 w-full max-w-md mx-auto">
          
          <motion.div
            initial={{ opacity: 0, x: 20, y: 0 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              y: [0, -6, 0]
            }}
            transition={{ 
              opacity: { duration: 0.6 },
              x: { duration: 0.6 },
              y: { 
                duration: 5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              } 
            }}
            className="relative bg-slate-900/85 backdrop-blur-xl rounded-2xl border border-slate-800/80 p-8 shadow-2xl overflow-hidden shadow-violet-500/5 hover:border-slate-700/80 transition-colors"
            id="login-card"
          >
            {/* Top glowing accent lines */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500" />
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-4 shadow-inner">
                <Tv2 className="w-8 h-8 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Connexion POWER IPTV
              </h1>
              <p className="text-sm text-slate-400">
                Entrez vos identifiants pour lancer instantanément vos chaînes en direct
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-sm"
                id="login-error-alert"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Erreur d'accès</span>
                  {error}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Nom d'utilisateur
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm font-mono"
                    placeholder="votre_username"
                    required
                    disabled={isLoading || isRedirecting}
                    id="login-username-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Mot de passe
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm font-mono"
                    placeholder="••••••••••••"
                    required
                    disabled={isLoading || isRedirecting}
                    id="login-password-input"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: isRedirecting ? 1 : 1.01 }}
                whileTap={{ scale: isRedirecting ? 1 : 0.99 }}
                type="submit"
                disabled={isLoading || isRedirecting}
                className="relative w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-600 hover:from-violet-500 hover:via-fuchsia-500 hover:to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 transition-all overflow-hidden flex items-center justify-center gap-2 cursor-pointer"
                id="login-submit-button"
              >
                {isRedirecting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <span className="text-emerald-400">Connexion réussie ! Lancement...</span>
                  </>
                ) : isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Chargement de votre flux...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 text-white fill-white animate-pulse" />
                    <span>Lancer mon flux TV</span>
                  </>
                )}
              </motion.button>
            </form>

          </motion.div>

        </div>

        {/* BLOCK 2: Marketplace Special Offer - SHOWN SECOND ON MOBILE (order-2) */}
        <div className="order-2 lg:order-1 lg:col-start-1 lg:col-span-7 lg:row-start-1">
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative bg-gradient-to-r from-violet-950/40 via-fuchsia-950/30 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-violet-500/30 p-6 shadow-xl overflow-hidden group"
          >
            {/* Pulsing light behind banner */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-500/10 blur-2xl group-hover:bg-violet-500/20 transition-all duration-500" />
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wider">
                  🛒 Offre Spéciale
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Pas encore d'abonnement actif ?
                </h3>
                <p className="text-xs text-slate-300">
                  Achetez vos accès instantanés 12 ou 24 mois sur notre Marketplace Partenaire au meilleur prix du marché.
                </p>
              </div>
              <motion.a
                whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(245, 158, 11, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                href="https://www.premium-iptv-market.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <ShoppingCart className="w-4 h-4 text-slate-950" />
                <span>Acheter un abonnement</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </motion.a>
            </div>
          </motion.div>

        </div>

        {/* BLOCK 3: TV Experience - SHOWN THIRD ON MOBILE (order-3) */}
        <div className="order-3 lg:order-1 lg:col-start-1 lg:col-span-7 lg:row-start-2">
          
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                L'expérience TV en Ultra Haute Définition
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Profitez d'un accès illimité à plus de 20 000 chaînes internationales et VOD à la demande.
              </p>
            </div>

            {/* Simulated TV / Channel preview images and Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card 1: Sports & Channels */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02, borderColor: "rgba(139, 92, 246, 0.4)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 group h-36 cursor-pointer"
              >
                <img 
                  src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80" 
                  alt="Sports Live"
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 group-hover:opacity-50 transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 space-y-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase tracking-widest shadow-md">
                    ⚽ LIVE SPORT
                  </span>
                  <h4 className="text-xs font-bold text-white">Canal+, beIN Sports, DAZN, RMC</h4>
                  <p className="text-[10px] text-slate-300">Ligue des Champions, Premier League, F1, UFC.</p>
                </div>
              </motion.div>

              {/* Card 2: Entertainment & Movies */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02, borderColor: "rgba(236, 72, 153, 0.4)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 group h-36 cursor-pointer"
              >
                <img 
                  src="https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=400&q=80" 
                  alt="Movies VOD"
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 group-hover:opacity-50 transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 space-y-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600 text-white text-[9px] font-extrabold uppercase tracking-widest shadow-md">
                    🎬 CINÉMA & VOD
                  </span>
                  <h4 className="text-xs font-bold text-white">Netflix, Disney+, Prime, Canal+</h4>
                  <p className="text-[10px] text-slate-300">Derniers blockbusters et séries exclusives.</p>
                </div>
              </motion.div>

            </div>

            {/* Channels Showcase & Badges */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Bouquets premium inclus & compatibles
              </span>
              <motion.div 
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08 }
                  }
                }}
                initial="hidden"
                animate="show"
                className="flex flex-wrap gap-2"
              >
                {/* Canal+ Styled badge */}
                <motion.span 
                  variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                  whileHover={{ scale: 1.08, y: -2, boxShadow: "0 4px 12px rgba(255,255,255,0.15)" }}
                  className="px-3 py-1 bg-white text-black font-extrabold text-[10px] rounded tracking-tighter border border-slate-200 shadow-sm uppercase flex items-center gap-1 select-none cursor-default transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  CANAL+
                </motion.span>
                {/* beIN Sports Styled badge */}
                <motion.span 
                  variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                  whileHover={{ scale: 1.08, y: -2, boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)" }}
                  className="px-3 py-1 bg-indigo-950 text-indigo-300 font-extrabold text-[10px] rounded tracking-wide border border-indigo-900 shadow-sm flex items-center gap-1 select-none cursor-default transition-all"
                >
                  beIN SPORTS
                </motion.span>
                {/* RMC Sport Styled badge */}
                <motion.span 
                  variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                  whileHover={{ scale: 1.08, y: -2, boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)" }}
                  className="px-3 py-1 bg-slate-950 text-red-500 font-bold text-[10px] rounded border border-red-900/30 flex items-center gap-1 select-none cursor-default transition-all"
                >
                  <span className="text-slate-400">RMC</span> SPORT
                </motion.span>
                {/* DAZN Styled badge */}
                <motion.span 
                  variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                  whileHover={{ scale: 1.08, y: -2, boxShadow: "0 4px 12px rgba(6, 182, 212, 0.25)" }}
                  className="px-3 py-1 bg-zinc-900 text-cyan-400 font-black text-[10px] rounded border border-cyan-500/20 flex items-center gap-1 select-none cursor-default transition-all"
                >
                  DAZN
                </motion.span>
                {/* TF1/M6 UHD styled */}
                <motion.span 
                  variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
                  whileHover={{ scale: 1.08, y: -2, boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}
                  className="px-3 py-1 bg-slate-950 text-emerald-400 font-bold text-[10px] rounded border border-emerald-500/10 select-none cursor-default transition-all"
                >
                  TNT FRANCE & INT.
                </motion.span>
              </motion.div>
            </div>

            {/* Key Quality Indicators */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/60">
              <motion.div 
                whileHover={{ scale: 1.05, y: -2 }}
                className="text-center space-y-1 cursor-default group"
              >
                <div className="text-violet-400 text-sm font-bold flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 group-hover:rotate-12 transition-transform duration-300" />
                  <span>4K UHD</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-tight transition-colors group-hover:text-slate-400">Fidélité visuelle maximale</p>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05, y: -2 }}
                className="text-center space-y-1 border-x border-slate-800/60 cursor-default group"
              >
                <div className="text-emerald-400 text-sm font-bold flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
                  <span>99.9%</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-tight transition-colors group-hover:text-slate-400">Serveurs anti-coupures</p>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05, y: -2 }}
                className="text-center space-y-1 cursor-default group"
              >
                <div className="text-amber-400 text-sm font-bold flex items-center justify-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-[360deg] transition-transform duration-1000" />
                  <span>Multi-D.</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-tight transition-colors group-hover:text-slate-400">SmartTV, Smartphone, Box</p>
              </motion.div>
            </div>

          </motion.div>

        </div>

      </div>
      
      <FAQSection />
    </div>
  );
}
