import React, { useState } from "react";
import { motion } from "motion/react";
import { Tv, Shield, Lock, User, AlertTriangle, RefreshCw } from "lucide-react";

interface IPTVLoginProps {
  onNavigateToAdmin: () => void;
}

export default function IPTVLogin({ onNavigateToAdmin }: IPTVLoginProps) {
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
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Impossible de se connecter au serveur.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md" id="iptv-login-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl overflow-hidden"
        id="login-card"
      >
        {/* Top glowing accent lines */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-4 shadow-inner">
            <Tv className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Portail IPTV Sécurisé
          </h1>
          <p className="text-sm text-slate-400">
            Connectez-vous pour déchiffrer et lancer votre flux sécurisé
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
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm"
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
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm"
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
            className="relative w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:via-fuchsia-500 hover:to-pink-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 transition-all overflow-hidden flex items-center justify-center gap-2 cursor-pointer"
            id="login-submit-button"
          >
            {isRedirecting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-emerald-400">Connexion réussie ! Redirection...</span>
              </>
            ) : isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Déchiffrement en cours...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>Accéder à mon flux</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
