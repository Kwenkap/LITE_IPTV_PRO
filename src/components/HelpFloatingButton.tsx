import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, X, Send, Mail, Clock, ShieldCheck, 
  CheckCircle, MessageSquare, AlertCircle, RefreshCw 
} from "lucide-react";

export default function HelpFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Veuillez remplir tous les champs requis.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de l'envoi du message.");
      }

      setIsSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Impossible d'envoyer votre demande au support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Button at Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-auto" id="help-floating-trigger">
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-full font-bold shadow-xl shadow-violet-500/20 border border-violet-500/30 cursor-pointer min-h-[44px] touch-manipulation hover:from-violet-500 hover:to-fuchsia-500 transition-all"
          aria-label="Ouvrir le support technique"
        >
          <HelpCircle className="w-5 h-5 text-white animate-bounce" />
          <span className="text-xs tracking-wide">Besoin d'aide ?</span>
        </motion.button>
      </div>

      {/* Modal Backdrop and Contact Form */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm pointer-events-auto">
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden shadow-violet-500/5 max-h-[90vh] flex flex-col"
              id="help-modal-card"
            >
              {/* Top gradient glowing border decoration */}
              <div className="h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 w-full" />

              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Support POWER IPTV</h3>
                    <p className="text-[10px] text-slate-400 font-mono tracking-wider">TICKET D'ASSISTANCE RAPIDE</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsSuccess(false);
                    setError("");
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                  aria-label="Fermer la modale"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                
                {/* Support Information Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex gap-3 items-center">
                    <Mail className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">EMAIL SUPPORT</span>
                      <a href="mailto:support@power-iptv-secure.com" className="text-xs font-bold text-slate-200 hover:text-violet-400 transition-colors block break-all">
                        support@power-iptv-secure.com
                      </a>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex gap-3 items-center">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">HORAIRES D'OUVERTURE</span>
                      <span className="text-xs font-bold text-slate-200 block">
                        7j/7, de 08:00 à 23:00
                      </span>
                    </div>
                  </div>
                </div>

                {isSuccess ? (
                  /* Success Screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-4"
                  >
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">Message Envoyé !</h4>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                        Merci pour votre demande. Un technicien de notre équipe support va l'étudier et vous répondre à l'adresse e-mail indiquée dans les plus brefs délais (généralement en moins de 30 minutes).
                      </p>
                    </div>
                    <button
                      onClick={() => setIsSuccess(false)}
                      className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-xs font-bold text-white rounded-lg transition-all"
                    >
                      Envoyer un autre message
                    </button>
                  </motion.div>
                ) : (
                  /* Message Form */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 px-1 pb-1">
                      <ShieldCheck className="w-4 h-4 text-violet-400" />
                      <span>Remplissez le formulaire pour générer un ticket de support instantané.</span>
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Votre Nom <span className="text-violet-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-xs"
                          placeholder="Ex: Jean Dupont"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Adresse E-mail <span className="text-violet-400">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-xs"
                          placeholder="dupont@exemple.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Description de votre problème <span className="text-violet-400">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-xs resize-none"
                        placeholder="Précisez votre nom d'utilisateur, le type d'appareil utilisé, et décrivez précisément le problème ou le message d'erreur..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold rounded-xl shadow-lg shadow-violet-500/15 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Traitement du ticket en cours...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Envoyer ma demande au support</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>
    </>
  );
}
