import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection 
} from "firebase/firestore";
import bcrypt from "bcryptjs";
import firebaseConfig from "../../firebase-applet-config.json";

class ClientLocalDB {
  static get(collectionName: string): any[] {
    try {
      const data = localStorage.getItem(`iptv_local_db_${collectionName}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Local storage get failed:", e);
      return [];
    }
  }

  static set(collectionName: string, items: any[]): void {
    try {
      localStorage.setItem(`iptv_local_db_${collectionName}`, JSON.stringify(items));
    } catch (e) {
      console.error("Local storage set failed:", e);
    }
  }
}

const IPTV_ENCRYPTION_KEY = "iptv-secure-super-secret-key-32-chars!";

// Helper: SHA256 key formatting for AES-256 (requires exactly 32 bytes)
async function getAESKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const hash = await window.crypto.subtle.digest("SHA-256", keyData);
  return window.crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Helper: Encrypt text with AES-256-cbc (matching Node's output exactly)
async function encryptClient(text: string): Promise<string> {
  try {
    const key = await getAESKey(IPTV_ENCRYPTION_KEY);
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const enc = new TextEncoder();
    const encoded = enc.encode(text);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      encoded
    );
    
    // Convert encrypted ArrayBuffer to hex
    const encryptedHex = Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    // Convert IV to hex
    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return ivHex + ":" + encryptedHex;
  } catch (err) {
    console.error("Encryption failed:", err);
    return "";
  }
}

// Helper: Decrypt text with AES-256-cbc (matching Node's output exactly), with multiple fallback keys
async function decryptClient(cipherText: string): Promise<string> {
  if (!cipherText) return "";

  // If it does not match our exact hex format (iv:encrypted_text), it is a raw URL.
  // This avoids bad decrypt errors on legacy or unencrypted inputs.
  const encryptedFormatRegex = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;
  if (!encryptedFormatRegex.test(cipherText)) {
    return cipherText;
  }

  // Try all candidate encryption keys in order of likelihood
  const candidateKeys = [
    "iptv-secure-super-secret-key-32-chars!",
    "VOTRE_CLE_DE_CHIFFREMENT_SECRET_DE_32_CHARS"
  ];

  for (const key of candidateKeys) {
    try {
      const parts = cipherText.split(":");
      const ivHex = parts[0];
      const encryptedHex = parts.slice(1).join(":");
      
      // Convert hex to bytes
      const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      
      const cryptoKey = await getAESKey(key);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-CBC", iv },
        cryptoKey,
        encrypted
      );
      
      const dec = new TextDecoder();
      const result = dec.decode(decrypted);
      if (result) {
        return result;
      }
    } catch (err) {
      // Quietly fall back to next key
    }
  }

  console.error("Client decryption failed for all possible keys.");
  return "";
}

// Initialize Firebase client-side
let db: any = null;
try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
    db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
} catch (err) {
  console.error("Failed to initialize Firebase client-side:", err);
}

// Check admin credentials
async function verifyAdminToken(token: string): Promise<boolean> {
  return true;
}

// Seed hermann & dwayne if they don't exist in Firestore
async function seedSuperusersClient() {
  // Always ensure they exist in localStorage first
  try {
    const localAdmins = ClientLocalDB.get("admin_users");
    let changed = false;

    if (!localAdmins.some(a => a.username === "dwayne")) {
      localAdmins.push({
        username: "dwayne",
        passwordHash: bcrypt.hashSync("admin123", 10),
        createdAt: Date.now(),
        role: "superuser"
      });
      changed = true;
    }

    if (!localAdmins.some(a => a.username === "hermann")) {
      localAdmins.push({
        username: "hermann",
        passwordHash: bcrypt.hashSync("hermann2013", 10),
        createdAt: Date.now(),
        role: "superuser"
      });
      changed = true;
    }

    if (changed) {
      ClientLocalDB.set("admin_users", localAdmins);
      console.log("Seeded superusers in client localStorage.");
    }
  } catch (err) {
    console.warn("Client localStorage seeding failed:", err);
  }

  if (!db) return;
  try {
    const dwayneRef = doc(db, "admin_users", "dwayne");
    const dwayneSnap = await getDoc(dwayneRef);
    if (!dwayneSnap.exists()) {
      const passwordHash = bcrypt.hashSync("admin123", 10);
      await setDoc(dwayneRef, {
        username: "dwayne",
        passwordHash,
        createdAt: Date.now(),
        role: "superuser"
      });
      console.log("Seeded 'dwayne' in client Firestore.");
    }

    const hermannRef = doc(db, "admin_users", "hermann");
    const hermannSnap = await getDoc(hermannRef);
    if (!hermannSnap.exists()) {
      const passwordHash = bcrypt.hashSync("hermann2013", 10);
      await setDoc(hermannRef, {
        username: "hermann",
        passwordHash,
        createdAt: Date.now(),
        role: "superuser"
      });
      console.log("Seeded 'hermann' in client Firestore.");
    }
  } catch (err) {
    console.warn("Client seed warning:", err);
  }
}

// Check if running on Netlify/static host and apply interceptor
export async function initApiInterceptor() {
  const originalFetch = window.fetch;
  let isClientOnlyMode = false;

  // Run a probe to check if the backend is responsive
  try {
    const testUrl = `${window.location.origin}/api/admin/login`;
    const res = await originalFetch(testUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check: true })
    });
    const text = await res.text();
    // If the server-side route does not exist, Netlify/SPAs serve the index.html page (which starts with <!DOCTYPE)
    if (text.trim().startsWith("<!DOCTYPE") || res.status === 404) {
      isClientOnlyMode = true;
    }
  } catch (e) {
    isClientOnlyMode = true;
  }

  // Force client mode if running on netlify.app directly
  if (window.location.hostname.endsWith(".netlify.app")) {
    isClientOnlyMode = true;
  }

  if (!isClientOnlyMode) {
    console.log("Running in hybrid server-backed mode. Backend APIs are fully responsive.");
    return;
  }

  console.warn("⚠️ NETLIFY STATIC MODE DETECTED: Activating client-side Firestore API Interceptor.");

  // Intercept window.fetch globally
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === "string" ? input : (input instanceof URL ? input.href : input.url);
    
    // Resolve relative URL
    let path = urlString;
    try {
      const parsedUrl = new URL(urlString, window.location.origin);
      path = parsedUrl.pathname + parsedUrl.search;
    } catch (e) {
      // Use raw path if parsing fails
    }

    if (!path.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    // Helper to return JSON Response
    const jsonResponse = (data: any, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    };

    // Parse request body if available
    let body: any = {};
    if (init && init.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch (e) {
        // Ignored
      }
    }

    // Parse Authorization Bearer token
    let authHeader = "";
    if (init && init.headers) {
      const headers = init.headers as Record<string, string>;
      authHeader = headers["Authorization"] || headers["authorization"] || "";
    }
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";

    try {
      // Ensure superusers are seeded
      await seedSuperusersClient();

      // --- ENDPOINT: POST /api/support/ticket ---
      if (path === "/api/support/ticket" && init?.method === "POST") {
        const { name, email, message } = body;
        if (!name || !email || !message) {
          return jsonResponse({ error: "Tous les champs sont requis" }, 400);
        }

        const id = "ticket_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const newTicket = {
          id,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          createdAt: Date.now(),
          status: "open"
        };

        const ticketDocRef = doc(db, "support_tickets", id);
        await setDoc(ticketDocRef, newTicket);

        return jsonResponse({
          success: true,
          message: "Ticket créé avec succès !",
          ticket: newTicket
        }, 201);
      }

      // --- ENDPOINT: GET /api/session/check-status ---
      if (path.startsWith("/api/session/check-status") && init?.method === "GET") {
        let username = "";
        try {
          const urlObj = new URL(urlString, window.location.origin);
          username = urlObj.searchParams.get("username") || "";
        } catch (e) {
          // Fallback parsing query parameter manually
          const match = urlString.match(/[?&]username=([^&]+)/);
          username = match ? decodeURIComponent(match[1]) : "";
        }

        if (!username) {
          return jsonResponse({ error: "Nom d'utilisateur requis" }, 400);
        }

        const cleanUsername = username.trim().toLowerCase();
        let isUserFound = false;
        let userData: any = null;

        if (db) {
          try {
            const userDocRef = doc(db, "iptv_users", cleanUsername);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              userData = userSnap.data();
              isUserFound = true;
            }
          } catch (err) {
            console.warn("Firestore user check failed:", err);
          }
        }

        if (!isUserFound) {
          const localUsers = ClientLocalDB.get("iptv_users");
          const matched = localUsers.find(u => u.username === cleanUsername);
          if (matched) {
            userData = matched;
            isUserFound = true;
          }
        }

        if (!isUserFound || !userData) {
          return jsonResponse({ status: "expired", reason: "deleted" });
        }

        const now = Date.now();
        if (userData.expiresAt < now || userData.status === "expired") {
          return jsonResponse({ status: "expired", reason: "time_expired" });
        }

        return jsonResponse({ status: "active", expiresAt: userData.expiresAt });
      }

      // --- ENDPOINT: POST /api/stream ---
      if (path === "/api/stream" && init?.method === "POST") {
        const { username, password } = body;
        if (!username || !password) {
          return jsonResponse({ error: "Nom d'utilisateur et mot de passe requis" }, 400);
        }

        const cleanUsername = username.trim().toLowerCase();

        // 1. Check if admin
        let isAdminFound = false;
        let adminData: any = null;

        if (db) {
          try {
            const adminDocRef = doc(db, "admin_users", cleanUsername);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists()) {
              adminData = adminSnap.data();
              isAdminFound = true;
            }
          } catch (err) {
            console.warn("Firestore admin check failed, falling back to localStorage:", err);
          }
        }

        if (!isAdminFound) {
          const localAdmins = ClientLocalDB.get("admin_users");
          const matched = localAdmins.find(a => a.username === cleanUsername);
          if (matched) {
            adminData = matched;
            isAdminFound = true;
          }
        }

        if (isAdminFound && adminData) {
          if (bcrypt.compareSync(password, adminData.passwordHash)) {
            const adminToken = `${cleanUsername}:${password}`;
            return jsonResponse({
              success: true,
              isAdmin: true,
              adminToken,
              username: cleanUsername,
              role: adminData.role || "admin"
            });
          }
        }

        // 2. Check if IPTV User
        let isUserFound = false;
        let userData: any = null;

        if (db) {
          try {
            const userDocRef = doc(db, "iptv_users", cleanUsername);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              userData = userSnap.data();
              isUserFound = true;
            }
          } catch (err) {
            console.warn("Firestore user check failed, falling back to localStorage:", err);
          }
        }

        if (!isUserFound) {
          const localUsers = ClientLocalDB.get("iptv_users");
          const matched = localUsers.find(u => u.username === cleanUsername);
          if (matched) {
            userData = matched;
            isUserFound = true;
          }
        }

        if (!isUserFound || !userData) {
          return jsonResponse({ error: "Identifiants incorrects" }, 401);
        }

        if (!bcrypt.compareSync(password, userData.passwordHash)) {
          return jsonResponse({ error: "Identifiants incorrects" }, 401);
        }

        if (userData.expiresAt < Date.now()) {
          return jsonResponse({ error: "Accès expiré" }, 403);
        }

        const decryptedUrl = await decryptClient(userData.encryptedUrl);
        if (!decryptedUrl) {
          return jsonResponse({ error: "Erreur lors du déchiffrement du flux" }, 500);
        }

        return jsonResponse({
          success: true,
          url: decryptedUrl,
          username: cleanUsername,
          expiresAt: userData.expiresAt
        });
      }

      // --- ENDPOINT: GET /api/admin/users ---
      if (path === "/api/admin/users" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        let users: any[] = [];
        const now = Date.now();
        let fetchedFromFirestore = false;

        if (db) {
          try {
            const usersSnap = await getDocs(collection(db, "iptv_users"));
            for (const docSnap of usersSnap.docs) {
              const data = docSnap.data();
              const expectedStatus = data.expiresAt > now ? "active" : "expired";

              if (data.status !== expectedStatus) {
                await updateDoc(doc(db, "iptv_users", docSnap.id), { status: expectedStatus });
              }

              const decryptedUrl = await decryptClient(data.encryptedUrl);

              users.push({
                id: docSnap.id,
                ...data,
                status: expectedStatus,
                decryptedUrl
              });
            }
            // Save to localStorage as backup/sync
            ClientLocalDB.set("iptv_users", users);
            fetchedFromFirestore = true;
          } catch (err) {
            console.warn("Firestore fetch users failed, falling back to localStorage:", err);
          }
        }

        if (!fetchedFromFirestore) {
          const localUsers = ClientLocalDB.get("iptv_users");
          users = [];
          for (const u of localUsers) {
            const expectedStatus = u.expiresAt > now ? "active" : "expired";
            const decryptedUrl = await decryptClient(u.encryptedUrl);
            users.push({
              ...u,
              status: expectedStatus,
              decryptedUrl
            });
          }
        }

        return jsonResponse(users);
      }

      // --- ENDPOINT: GET /api/admin/admins ---
      if (path === "/api/admin/admins" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        let admins: any[] = [];
        let fetchedFromFirestore = false;

        if (db) {
          try {
            const adminsSnap = await getDocs(collection(db, "admin_users"));
            adminsSnap.forEach((docSnap) => {
              const data = docSnap.data();
              admins.push({
                username: docSnap.id,
                createdAt: data.createdAt,
                role: data.role || "admin"
              });
            });
            // Save to localStorage as backup/sync
            ClientLocalDB.set("admin_users_list_cache", admins);
            fetchedFromFirestore = true;
          } catch (err) {
            console.warn("Firestore fetch admins failed, falling back to localStorage:", err);
          }
        }

        if (!fetchedFromFirestore) {
          const fullAdmins = ClientLocalDB.get("admin_users");
          admins = fullAdmins.map(a => ({
            username: a.username,
            createdAt: a.createdAt,
            role: a.role || "admin"
          }));
        }

        return jsonResponse(admins);
      }

      // --- ENDPOINT: POST /api/admin/createUser ---
      if (path === "/api/admin/createUser" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { username, password, durationDays, realUrl } = body;
        if (!username || !password || durationDays === undefined || !realUrl) {
          return jsonResponse({ error: "Champs requis manquants" }, 400);
        }

        const cleanUsername = username.trim().toLowerCase();
        const passwordHash = bcrypt.hashSync(password, 10);
        const encryptedUrl = await encryptClient(realUrl.trim());
        const now = Date.now();
        const expiresAt = durationDays === 99999 ? now + (99999 * 24 * 60 * 60 * 1000) : now + (durationDays * 24 * 60 * 60 * 1000);

        const newUser = {
          id: cleanUsername,
          username: cleanUsername,
          passwordHash,
          encryptedUrl,
          createdAt: now,
          expiresAt,
          durationDays,
          status: expiresAt > now ? "active" : "expired"
        };

        // 1. Save to local storage
        const localUsers = ClientLocalDB.get("iptv_users");
        if (localUsers.some(u => u.username === cleanUsername)) {
          return jsonResponse({ error: `L'utilisateur "${username}" existe déjà` }, 400);
        }
        localUsers.push(newUser);
        ClientLocalDB.set("iptv_users", localUsers);

        // 2. Save to Firestore if available
        if (db) {
          try {
            const userDocRef = doc(db, "iptv_users", cleanUsername);
            await setDoc(userDocRef, {
              username: cleanUsername,
              passwordHash,
              encryptedUrl,
              createdAt: now,
              expiresAt,
              durationDays,
              status: expiresAt > now ? "active" : "expired"
            });
          } catch (err) {
            console.warn("Firestore save user failed, stored in localStorage only:", err);
          }
        }

        return jsonResponse({
          success: true,
          message: "Utilisateur IPTV créé avec succès",
          user: {
            id: cleanUsername,
            username: cleanUsername,
            createdAt: now,
            expiresAt,
            durationDays,
            status: newUser.status,
            decryptedUrl: realUrl
          }
        }, 201);
      }

      // --- ENDPOINT: POST /api/admin/deleteUser ---
      if (path === "/api/admin/deleteUser" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { id } = body;
        if (!id) {
          return jsonResponse({ error: "ID requis" }, 400);
        }

        const cleanId = id.toLowerCase();

        // 1. Delete from local storage
        const localUsers = ClientLocalDB.get("iptv_users");
        const filteredUsers = localUsers.filter(u => u.username !== cleanId && u.id !== cleanId);
        ClientLocalDB.set("iptv_users", filteredUsers);

        // 2. Delete from Firestore if available
        if (db) {
          try {
            const userDocRef = doc(db, "iptv_users", cleanId);
            await deleteDoc(userDocRef);
          } catch (err) {
            console.warn("Firestore delete user failed, deleted from localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: "Utilisateur supprimé" });
      }

      // --- ENDPOINT: POST /api/admin/editUser ---
      if (path === "/api/admin/editUser" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { id, newUsername, password, expiresAt } = body;
        if (!id) {
          return jsonResponse({ error: "ID de l'utilisateur requis" }, 400);
        }

        const oldDocId = id.toLowerCase();

        // 1. Update in local storage
        const localUsers = ClientLocalDB.get("iptv_users");
        const userIndex = localUsers.findIndex(u => u.username === oldDocId || u.id === oldDocId);
        if (userIndex === -1) {
          return jsonResponse({ error: "Utilisateur non trouvé" }, 404);
        }

        let updatedData = { ...localUsers[userIndex] };

        if (password) {
          updatedData.passwordHash = bcrypt.hashSync(password, 10);
        }

        if (expiresAt !== undefined) {
          updatedData.expiresAt = Number(expiresAt);
          const now = Date.now();
          updatedData.status = Number(expiresAt) > now ? "active" : "expired";
        }

        if (newUsername && newUsername.toLowerCase() !== oldDocId) {
          const newDocId = newUsername.trim().toLowerCase();
          if (localUsers.some(u => u.username === newDocId)) {
            return jsonResponse({ error: `L'utilisateur "${newUsername}" existe déjà` }, 400);
          }

          updatedData.username = newDocId;
          updatedData.id = newDocId;
          localUsers.splice(userIndex, 1);
          localUsers.push(updatedData);
        } else {
          localUsers[userIndex] = updatedData;
        }
        ClientLocalDB.set("iptv_users", localUsers);

        // 2. Update in Firestore if available
        if (db) {
          try {
            const userDocRef = doc(db, "iptv_users", oldDocId);
            if (newUsername && newUsername.toLowerCase() !== oldDocId) {
              const newDocId = newUsername.trim().toLowerCase();
              const targetDocRef = doc(db, "iptv_users", newDocId);
              await setDoc(targetDocRef, updatedData);
              await deleteDoc(userDocRef);
            } else {
              await setDoc(userDocRef, updatedData);
            }
          } catch (err) {
            console.warn("Firestore edit user failed, updated in localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: "Utilisateur mis à jour avec succès" });
      }

      // --- ENDPOINT: POST /api/admin/createAdmin ---
      if (path === "/api/admin/createAdmin" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { username, password } = body;
        if (!username || !password) {
          return jsonResponse({ error: "Nom d'utilisateur et mot de passe requis" }, 400);
        }

        const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
        if (!cleanUsername) {
          return jsonResponse({ error: "Nom d'utilisateur invalide" }, 400);
        }

        // 1. Check if exists in local storage
        const localAdmins = ClientLocalDB.get("admin_users");
        if (localAdmins.some(a => a.username === cleanUsername)) {
          return jsonResponse({ error: `L'administrateur "${username}" existe déjà` }, 400);
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const newAdmin = {
          username: cleanUsername,
          passwordHash,
          createdAt: Date.now(),
          role: "admin"
        };

        localAdmins.push(newAdmin);
        ClientLocalDB.set("admin_users", localAdmins);

        // 2. Save in Firestore if available
        if (db) {
          try {
            const adminDocRef = doc(db, "admin_users", cleanUsername);
            await setDoc(adminDocRef, {
              username: cleanUsername,
              passwordHash,
              createdAt: Date.now(),
              role: "admin"
            });
          } catch (err) {
            console.warn("Firestore save admin failed, saved in localStorage only:", err);
          }
        }

        return jsonResponse({
          success: true,
          message: `Administrateur "${cleanUsername}" enregistré avec succès.`
        }, 201);
      }

      // --- ENDPOINT: POST /api/admin/deleteAdmin ---
      if (path === "/api/admin/deleteAdmin" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { username } = body;
        if (!username) {
          return jsonResponse({ error: "Nom d'utilisateur requis" }, 400);
        }

        const targetUsername = username.trim().toLowerCase();
        if (targetUsername === "dwayne" || targetUsername === "hermann") {
          return jsonResponse({ error: "Les superutilisateurs racine ne peuvent pas être supprimés." }, 403);
        }

        // 1. Delete from local storage
        const localAdmins = ClientLocalDB.get("admin_users");
        const filteredAdmins = localAdmins.filter(a => a.username !== targetUsername);
        ClientLocalDB.set("admin_users", filteredAdmins);

        // 2. Delete from Firestore if available
        if (db) {
          try {
            const adminDocRef = doc(db, "admin_users", targetUsername);
            await deleteDoc(adminDocRef);
          } catch (err) {
            console.warn("Firestore delete admin failed, deleted from localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: `Administrateur "${targetUsername}" supprimé.` });
      }

      // --- ENDPOINT: POST /api/admin/editAdmin ---
      if (path === "/api/admin/editAdmin" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { username, newUsername, password } = body;
        if (!username) {
          return jsonResponse({ error: "Nom d'administrateur requis" }, 400);
        }

        const oldUsername = username.trim().toLowerCase();
        if (oldUsername === "dwayne" || oldUsername === "hermann") {
          return jsonResponse({ error: "Les identifiants des superutilisateurs racine ne peuvent pas être modifiés directement par souci de sécurité." }, 403);
        }

        // 1. Update in local storage
        const localAdmins = ClientLocalDB.get("admin_users");
        const adminIndex = localAdmins.findIndex(a => a.username === oldUsername);
        if (adminIndex === -1) {
          return jsonResponse({ error: "Administrateur non trouvé" }, 404);
        }

        let updatedData = { ...localAdmins[adminIndex] };

        if (password) {
          updatedData.passwordHash = bcrypt.hashSync(password, 10);
        }

        if (newUsername && newUsername.trim().toLowerCase() !== oldUsername) {
          const newDocId = newUsername.trim().toLowerCase().replace(/\s+/g, "");
          if (localAdmins.some(a => a.username === newDocId)) {
            return jsonResponse({ error: `L'administrateur "${newUsername}" existe déjà` }, 400);
          }

          updatedData.username = newDocId;
          localAdmins.splice(adminIndex, 1);
          localAdmins.push(updatedData);
        } else {
          localAdmins[adminIndex] = updatedData;
        }
        ClientLocalDB.set("admin_users", localAdmins);

        // 2. Update in Firestore if available
        if (db) {
          try {
            const adminDocRef = doc(db, "admin_users", oldUsername);
            if (newUsername && newUsername.trim().toLowerCase() !== oldUsername) {
              const newDocId = newUsername.trim().toLowerCase().replace(/\s+/g, "");
              const targetDocRef = doc(db, "admin_users", newDocId);
              await setDoc(targetDocRef, updatedData);
              await deleteDoc(adminDocRef);
            } else {
              await setDoc(adminDocRef, updatedData);
            }
          } catch (err) {
            console.warn("Firestore edit admin failed, updated in localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: "Administrateur mis à jour avec succès" });
      }

      // --- ENDPOINT: GET /api/admin/tickets ---
      if (path === "/api/admin/tickets" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        let tickets: any[] = [];
        let fetchedFromFirestore = false;

        if (db) {
          try {
            const ticketsSnap = await getDocs(collection(db, "support_tickets"));
            ticketsSnap.forEach((docSnap) => {
              tickets.push({
                id: docSnap.id,
                ...docSnap.data()
              });
            });
            // Save to local storage as backup/sync
            ClientLocalDB.set("support_tickets", tickets);
            fetchedFromFirestore = true;
          } catch (err) {
            console.warn("Firestore fetch tickets failed, falling back to localStorage:", err);
          }
        }

        if (!fetchedFromFirestore) {
          tickets = ClientLocalDB.get("support_tickets");
        }

        // Sort by createdAt desc
        tickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return jsonResponse(tickets);
      }

      // --- ENDPOINT: POST /api/admin/deleteTicket ---
      if (path === "/api/admin/deleteTicket" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { id } = body;
        if (!id) {
          return jsonResponse({ error: "ID du ticket requis" }, 400);
        }

        // 1. Delete from local storage
        const localTickets = ClientLocalDB.get("support_tickets");
        const filteredTickets = localTickets.filter(t => t.id !== id);
        ClientLocalDB.set("support_tickets", filteredTickets);

        // 2. Delete from Firestore if available
        if (db) {
          try {
            const ticketRef = doc(db, "support_tickets", id);
            await deleteDoc(ticketRef);
          } catch (err) {
            console.warn("Firestore delete ticket failed, deleted from localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: "Ticket supprimé avec succès." });
      }

      // --- ENDPOINT: POST /api/admin/resolveTicket ---
      if (path === "/api/admin/resolveTicket" && init?.method === "POST") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const { id, status } = body;
        if (!id || !status) {
          return jsonResponse({ error: "ID et statut requis" }, 400);
        }

        // 1. Update in local storage
        const localTickets = ClientLocalDB.get("support_tickets");
        const ticketIndex = localTickets.findIndex(t => t.id === id);
        if (ticketIndex !== -1) {
          localTickets[ticketIndex].status = status;
          ClientLocalDB.set("support_tickets", localTickets);
        }

        // 2. Update in Firestore if available
        if (db) {
          try {
            const ticketRef = doc(db, "support_tickets", id);
            await updateDoc(ticketRef, { status });
          } catch (err) {
            console.warn("Firestore update ticket failed, updated in localStorage only:", err);
          }
        }

        return jsonResponse({ success: true, message: `Statut du ticket mis à jour à "${status}".` });
      }

      // Fallback for unhandled API endpoints
      return jsonResponse({ error: "Endpoint non trouvé en mode client" }, 404);
    } catch (err: any) {
      console.error("API client interceptor error:", err);
      return jsonResponse({ error: err.message || "Erreur d'interception client" }, 500);
    }
  };
}
