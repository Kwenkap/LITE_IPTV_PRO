import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, Lock, Users, UserPlus, Trash2, Copy, CheckCircle, 
  Search, LogOut, Key, Calendar, Tv, Clock, Eye, EyeOff, Plus, AlertTriangle, ChevronRight, Sparkles, RefreshCw, User,
  MessageSquare, Check, Inbox, Mail, FileText
} from "lucide-react";

interface IPTVUser {
  id: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  durationDays: number;
  status: "active" | "expired";
  decryptedUrl: string;
}

interface AdminUser {
  username: string;
  createdAt: number;
  role: "superuser" | "admin";
}

interface IPTVAdminProps {
  onNavigateToLogin: () => void;
}

export default function IPTVAdmin({ onNavigateToLogin }: IPTVAdminProps) {
  // Authentication states
  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem("iptv_admin_token") || "bypass";
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"users" | "admins" | "tickets">("users");

  // IPTV Users States
  const [users, setUsers] = useState<IPTVUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Support Tickets States
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [searchTicketQuery, setSearchTicketQuery] = useState("");

  // Administrators States
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [searchAdminQuery, setSearchAdminQuery] = useState("");

  // IPTV Creation Form States
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [durationPreset, setDurationPreset] = useState("30"); // days, 'custom', or '99999' for unlimited
  const [customDays, setCustomDays] = useState("1");
  const [realUrl, setRealUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [createdUserLink, setCreatedUserLink] = useState("");

  // Administrator Creation Form States
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");

  // UI Helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [visibleUrls, setVisibleUrls] = useState<Record<string, boolean>>({});

  // Auto-verify saved token on mount
  useEffect(() => {
    if (adminToken) {
      fetchUsers(adminToken);
      fetchAdmins(adminToken);
      fetchTickets(adminToken);
    }
  }, []);

  // Fetch IPTV Users from database
  const fetchUsers = async (token = adminToken) => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        setIsAuthenticated(true);
      } else if (response.status === 401 || response.status === 403) {
        handleLogout();
      }
    } catch (err) {
      console.error("Erreur chargement utilisateurs :", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Administrators list from database
  const fetchAdmins = async (token = adminToken) => {
    if (!token) return;
    setLoadingAdmins(true);
    try {
      const response = await fetch("/api/admin/admins", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminsList(data);
      }
    } catch (err) {
      console.error("Erreur chargement administrateurs :", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Fetch Support Tickets from database
  const fetchTickets = async (token = adminToken) => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const response = await fetch("/api/admin/tickets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (err) {
      console.error("Erreur chargement tickets :", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Resolve / Reopen support ticket
  const handleResolveTicket = async (ticketId: string, currentStatus: string) => {
    const newStatus = currentStatus === "open" ? "resolved" : "open";
    try {
      const response = await fetch("/api/admin/resolveTicket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      });
      if (response.ok) {
        // Optimistic / update state
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      console.error("Erreur mise à jour ticket :", err);
    }
  };

  // Delete support ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce ticket de support ?")) {
      return;
    }
    try {
      const response = await fetch("/api/admin/deleteTicket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ id: ticketId }),
      });
      if (response.ok) {
        setTickets(prev => prev.filter(t => t.id !== ticketId));
      }
    } catch (err) {
      console.error("Erreur suppression ticket :", err);
    }
  };

  // Verify and Authenticate Admin credentials
  const verifyAdminCredentials = async (usernameInput: string, passwordInput: string) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput }),
      });
      const data = await response.json();
      if (response.ok && data.isAdmin) {
        setIsAuthenticated(true);
        setAdminToken(data.adminToken);
        localStorage.setItem("iptv_admin_token", data.adminToken);
        fetchUsers(data.adminToken);
        fetchAdmins(data.adminToken);
        fetchTickets(data.adminToken);
      } else {
        setAuthError(data.error || "Identifiants administrateur incorrects ou accès non autorisé.");
        localStorage.removeItem("iptv_admin_token");
        setAdminToken("");
      }
    } catch (err) {
      setAuthError("Impossible de contacter le serveur d'administration.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsernameInput.trim() || !adminPasswordInput.trim()) {
      setAuthError("Veuillez saisir votre nom d'utilisateur et votre mot de passe.");
      return;
    }
    verifyAdminCredentials(adminUsernameInput, adminPasswordInput);
  };

  const handleLogout = () => {
    localStorage.removeItem("iptv_admin_token");
    onNavigateToLogin();
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(generated);
  };

  // Create IPTV user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setCreatedUserLink("");

    if (!newUsername.trim()) {
      setFormError("Nom d'utilisateur requis.");
      return;
    }
    if (!newPassword.trim()) {
      setFormError("Mot de passe requis.");
      return;
    }
    if (!realUrl.trim() || !realUrl.startsWith("http")) {
      setFormError("Veuillez saisir un lien de flux valide (commençant par http:// ou https://).");
      return;
    }

    const finalDurationDays = durationPreset === "custom" 
      ? parseFloat(customDays) 
      : parseFloat(durationPreset);

    if (isNaN(finalDurationDays) || finalDurationDays <= 0) {
      setFormError("La durée de validité doit être supérieure à 0.");
      return;
    }

    try {
      const response = await fetch("/api/admin/createUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          durationDays: finalDurationDays,
          realUrl: realUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur s'est produite lors de la création.");
      }

      setFormSuccess(`L'utilisateur IPTV "${newUsername}" a été créé avec succès !`);
      
      // Build the direct playlist link
      const origin = window.location.origin;
      const directUrl = `${origin}/api/stream?u=${encodeURIComponent(newUsername.trim())}&p=${encodeURIComponent(newPassword)}`;
      setCreatedUserLink(directUrl);

      // Reset form fields
      setNewUsername("");
      setNewPassword("");
      setRealUrl("");
      
      // Refresh user list
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || "Erreur lors de la communication avec le serveur.");
    }
  };

  // Delete IPTV user
  const handleDeleteUser = async (id: string, username: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'accès pour "${username}" ?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/deleteUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur de suppression.");
      }
    } catch (err) {
      console.error("Erreur suppression :", err);
    }
  };

  // Register other admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError("");
    setAdminFormSuccess("");

    if (!newAdminUsername.trim()) {
      setAdminFormError("Nom d'utilisateur requis.");
      return;
    }
    if (!newAdminPassword.trim()) {
      setAdminFormError("Mot de passe requis.");
      return;
    }

    try {
      const response = await fetch("/api/admin/createAdmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username: newAdminUsername.trim(),
          password: newAdminPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur d'enregistrement.");
      }

      setAdminFormSuccess(data.message || "Administrateur enregistré avec succès !");
      setNewAdminUsername("");
      setNewAdminPassword("");
      fetchAdmins();
    } catch (err: any) {
      setAdminFormError(err.message || "Erreur lors de l'enregistrement.");
    }
  };

  // Delete admin
  const handleDeleteAdmin = async (targetUsername: string) => {
    if (targetUsername.toLowerCase() === "dwayne") {
      alert("Le superutilisateur racine 'dwayne' ne peut pas être supprimé.");
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir révoquer les privilèges d'administration de "${targetUsername}" ?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/deleteAdmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ username: targetUsername }),
      });

      if (response.ok) {
        setAdminsList((prev) => prev.filter((a) => a.username !== targetUsername));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur de révocation.");
      }
    } catch (err) {
      console.error("Erreur suppression admin :", err);
    }
  };

  const copyText = (text: string, id: string, type: "user" | "text" = "user") => {
    navigator.clipboard.writeText(text);
    if (type === "user") {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const toggleUrlVisibility = (id: string) => {
    setVisibleUrls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getRemainingTime = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Expiré";
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 1000) return "Illimité";
    if (days > 0) return `${days}j ${hours}h restants`;
    return `${hours}h restantes`;
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAdmins = adminsList.filter((a) =>
    a.username.toLowerCase().includes(searchAdminQuery.toLowerCase())
  );

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const expiredUsers = users.filter((u) => u.status === "expired").length;

  // Render unified security login gate if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md" id="admin-auth-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden"
          id="admin-auth-card"
        >
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 via-violet-500 to-fuchsia-500" />
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-4 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Console Administrateur
            </h1>
            <p className="text-sm text-slate-400">
              Veuillez saisir vos identifiants pour administrer la plateforme POWER IPTV
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Nom d'utilisateur Admin
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"
                  placeholder="ex: dwayne"
                  required
                  id="admin-username-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"
                  placeholder="••••••••••••"
                  required
                  id="admin-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 via-violet-600 to-fuchsia-600 hover:from-red-500 hover:via-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 focus:outline-none disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer pt-3"
              id="admin-login-btn"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  <span>Déverrouiller la Console</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <button
              onClick={onNavigateToLogin}
              className="text-xs font-medium text-slate-400 hover:text-white hover:underline transition-colors cursor-pointer"
              id="back-to-client-login-btn"
            >
              Retourner au portail client IPTV
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl px-4 py-2" id="admin-dashboard-container">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Console POWER IPTV <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Connecté</span>
            </h1>
            <p className="text-xs text-slate-400">Gérez vos clients, enregistrez de nouveaux administrateurs et suivez les abonnements</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onNavigateToLogin}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-all cursor-pointer"
            id="view-client-portal-btn"
          >
            <Tv className="w-4 h-4" />
            Portail IPTV
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
            title="Se déconnecter"
            id="admin-logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6" id="admin-stats-grid">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-slate-800 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Total Comptes Clients</p>
            <p className="text-3xl font-extrabold text-white">{totalUsers}</p>
          </div>
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-slate-800 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Comptes Clients Actifs</p>
            <p className="text-3xl font-extrabold text-emerald-400">{activeUsers}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-slate-800 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Comptes Clients Expirés</p>
            <p className="text-3xl font-extrabold text-rose-400">{expiredUsers}</p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-6 mb-6 border-b border-slate-800 pb-px" id="admin-tabs-nav">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "users"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Gestion des Clients IPTV
        </button>
        <button
          onClick={() => {
            setActiveTab("admins");
            fetchAdmins();
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "admins"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Gestion des Administrateurs (Accès Équivalents)
        </button>
        <button
          onClick={() => {
            setActiveTab("tickets");
            fetchTickets();
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer relative ${
            activeTab === "tickets"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Tickets de Support Client
          {tickets.filter(t => t.status === "open").length > 0 && (
            <span className="absolute -top-1.5 -right-3.5 bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
              {tickets.filter(t => t.status === "open").length}
            </span>
          )}
        </button>
      </div>

      {/* Conditional Rendering based on selected tab */}
      {activeTab === "users" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="users-tab-content">
          
          {/* Left Side: Create User Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden" id="admin-create-user-panel">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
              
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-400" />
                Créer un nouvel utilisateur IPTV
              </h2>

              {formError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Nom d'utilisateur IPTV
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm"
                    placeholder="ex: client_jean"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                    Mot de passe IPTV
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Générer
                    </button>
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm font-mono"
                    placeholder="Saisissez ou générez"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Durée d'abonnement
                    </label>
                    <select
                      value={durationPreset}
                      onChange={(e) => setDurationPreset(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-violet-500 text-sm cursor-pointer"
                    >
                      <option value="1">24 Heures</option>
                      <option value="7">7 Jours (Test)</option>
                      <option value="30">30 Jours (1 Mois)</option>
                      <option value="90">90 Jours (3 Mois)</option>
                      <option value="180">180 Jours (6 Mois)</option>
                      <option value="365">365 Jours (1 An)</option>
                      <option value="99999">Illimité / Permanent</option>
                      <option value="custom">Autre (Personnalisé)</option>
                    </select>
                  </div>

                  {durationPreset === "custom" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                        Nombre de Jours
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-violet-500 text-sm"
                        placeholder="Ex: 15"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Lien Réel de Flux IPTV (Source)
                  </label>
                  <textarea
                    value={realUrl}
                    onChange={(e) => setRealUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm font-mono h-20 resize-none"
                    placeholder="http://huhu.to/get.php?auth=xyz..."
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ce lien sera associe a des parametres de session dynamiques pour securiser l'acces de vos clients.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Créer l'Accès IPTV</span>
                </motion.button>
              </form>
            </div>

            {/* User link box on creation success */}
            <AnimatePresence>
              {createdUserLink && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-violet-950/40 border border-violet-500/30 rounded-2xl p-5 space-y-3 shadow-lg"
                >
                  <div className="flex items-center gap-2 text-violet-300 font-semibold text-sm">
                    <ChevronRight className="w-4 h-4 animate-ping" />
                    Lien d'intégration directe VLC / Player
                  </div>
                  <p className="text-xs text-slate-400">
                    Donnez ce lien a votre client. Il gere l'abonnement et l'expiration en redirigeant en arriere-plan vers le flux actif.
                  </p>
                  <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="text"
                      readOnly
                      value={createdUserLink}
                      className="bg-transparent border-none text-white focus:outline-none text-xs w-full font-mono select-all"
                    />
                    <button
                      onClick={() => copyText(createdUserLink, "new-user-link", "text")}
                      className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedText === "new-user-link" ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Side: Users List */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col h-[650px]" id="admin-users-list-panel">
              
              {/* List Header / Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-400" />
                  Liste des Utilisateurs ({filteredUsers.length})
                </h2>
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 text-xs"
                    placeholder="Rechercher par nom..."
                  />
                </div>
              </div>

              {/* Users Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
                {loadingUsers ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
                    Chargement des utilisateurs...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
                    <Tv className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Aucun utilisateur trouve</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">Creez votre premier utilisateur a l'aide du formulaire de gauche pour demarrer la gestion d'abonnements.</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const directLink = `${window.location.origin}/api/stream?u=${encodeURIComponent(user.username)}&p=PARTAGER_MOT_DE_PASSE`;
                    const isUrlVisible = visibleUrls[user.id] || false;

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-xl transition-all relative group"
                        key={user.id}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${user.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              <Tv className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-white font-mono">{user.username}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500">Créé le {new Date(user.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-600">•</span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {getRemainingTime(user.expiresAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              user.status === "active" 
                                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/5 text-rose-400 border-rose-500/20"
                            }`}>
                              {user.status === "active" ? "Actif" : "Expiré"}
                            </span>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer l'accès"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Display Decrypted Stream Url and Copy Link Widget */}
                        <div className="space-y-2 mt-3 pt-3 border-t border-slate-850/60 text-xs">
                          {/* Decrypted Source URL */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Lien Source Réel</span>
                            <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-[420px]">
                                {isUrlVisible ? user.decryptedUrl : "••••••••••••••••••••••••••••••••••••••••"}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => toggleUrlVisibility(user.id)}
                                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  title={isUrlVisible ? "Masquer" : "Révéler le flux"}
                                >
                                  {isUrlVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                {isUrlVisible && (
                                  <button
                                    onClick={() => copyText(user.decryptedUrl, `${user.id}-source`)}
                                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {copiedId === `${user.id}-source` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Direct Secure Integration Link */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Lien d'Accès Client (VLC / Tivimate)</span>
                            <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                              <span className="font-mono text-[11px] text-violet-400 truncate max-w-[280px] sm:max-w-[420px]">
                                {directLink}
                              </span>
                              <button
                                onClick={() => copyText(directLink, `${user.id}-direct`)}
                                className="p-1 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                                title="Copier le modèle"
                              >
                                {copiedId === `${user.id}-direct` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
              
            </div>
          </div>

        </div>
      ) : activeTab === "admins" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admins-tab-content">
          
          {/* Left Side: Create Administrator Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-violet-500" />
              
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-400" />
                Enregistrer un administrateur
              </h2>

              {adminFormError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminFormError}</span>
                </div>
              )}

              {adminFormSuccess && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Nom d'utilisateur Admin
                  </label>
                  <input
                    type="text"
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm"
                    placeholder="ex: dwayne2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm font-mono"
                    placeholder="Saisissez le mot de passe"
                    required
                  />
                </div>

                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                  <Shield className="w-3.5 h-3.5 text-red-400 inline mr-1.5 align-text-bottom" />
                  <strong>Attention :</strong> Le nouvel administrateur disposera des mêmes accès et privilèges de gestion de la plateforme. Enregistrez uniquement des personnes de confiance.
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-violet-600 hover:from-red-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Enregistrer l'Administrateur</span>
                </motion.button>
              </form>
            </div>
          </div>

          {/* Right Side: Administrators List */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col h-[550px]">
              
              {/* List Header / Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-400" />
                  Liste des Administrateurs ({filteredAdmins.length})
                </h2>
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchAdminQuery}
                    onChange={(e) => setSearchAdminQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs"
                    placeholder="Rechercher par nom..."
                  />
                </div>
              </div>

              {/* Admins Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
                {loadingAdmins ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                    Chargement des administrateurs...
                  </div>
                ) : filteredAdmins.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
                    <Shield className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Aucun administrateur trouvé</p>
                  </div>
                ) : (
                  filteredAdmins.map((adminUser) => {
                    const isRoot = adminUser.username.toLowerCase() === "dwayne";

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-xl transition-all relative group"
                        key={adminUser.username}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${isRoot ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400"}`}>
                              <Shield className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-white font-mono flex items-center gap-2">
                                {adminUser.username}
                                {isRoot && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 font-sans uppercase font-bold tracking-wider">Superuser</span>
                                )}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500">Enregistré le {new Date(adminUser.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-600">•</span>
                                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider text-[9px]">{adminUser.role}</span>
                              </div>
                            </div>
                          </div>

                          {!isRoot && (
                            <button
                              onClick={() => handleDeleteAdmin(adminUser.username)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                              title="Révoquer les accès admin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
              
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-6" id="tickets-tab-content">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-violet-400" />
                  Boîte de Réception des Demandes Support ({tickets.length})
                </h2>
                <p className="text-xs text-slate-400">Consultez les messages envoyés par les clients et mettez à jour leur statut d'assistance</p>
              </div>
              
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Rechercher un ticket..."
                  value={searchTicketQuery}
                  onChange={(e) => setSearchTicketQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 text-xs transition-all"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Tickets list */}
            {loadingTickets ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
                Chargement des tickets d'assistance...
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                <Inbox className="w-16 h-16 mb-4 opacity-15 text-violet-400" />
                <p className="text-sm font-semibold">Aucun ticket d'assistance pour le moment</p>
                <p className="text-xs text-slate-600 mt-1">Les messages soumis par vos utilisateurs s'afficheront ici en temps réel.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets
                  .filter(ticket => {
                    const q = searchTicketQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      ticket.name?.toLowerCase().includes(q) ||
                      ticket.email?.toLowerCase().includes(q) ||
                      ticket.message?.toLowerCase().includes(q)
                    );
                  })
                  .map((ticket) => {
                    const isOpen = ticket.status === "open";
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-800 p-5 rounded-xl transition-all"
                        key={ticket.id}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${isOpen ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{ticket.name}</span>
                                <span className="text-[10px] text-slate-600 font-mono">({ticket.id})</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <a href={`mailto:${ticket.email}`} className="hover:text-violet-400 transition-colors flex items-center gap-1 font-mono text-[11px]">
                                  <Mail className="w-3 h-3 text-slate-500" />
                                  {ticket.email}
                                </a>
                                <span className="text-slate-600">•</span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  {new Date(ticket.createdAt).toLocaleString("fr-FR")}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              isOpen 
                                ? "bg-rose-500/5 text-rose-400 border-rose-500/20" 
                                : "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                            }`}>
                              {isOpen ? "Ouvert" : "Résolu"}
                            </span>
                            
                            <button
                              onClick={() => handleResolveTicket(ticket.id, ticket.status)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isOpen 
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300" 
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                              }`}
                              title={isOpen ? "Marquer comme résolu" : "Réouvrir le ticket"}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer ce message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900/60 text-sm text-slate-300 leading-relaxed shadow-inner font-normal whitespace-pre-wrap">
                          {ticket.message}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
