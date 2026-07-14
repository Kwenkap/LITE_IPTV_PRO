import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
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
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.error("Failed to initialize Firebase client-side:", err);
}

// Check admin credentials
async function verifyAdminToken(token: string): Promise<boolean> {
  if (!db || !token) return false;
  try {
    const parts = token.split(":");
    if (parts.length < 2) return false;
    const username = parts[0].toLowerCase();
    const password = parts.slice(1).join(":");

    // Ensure default superusers exist on the client side Firestore
    await seedSuperusersClient();

    const adminDocRef = doc(db, "admin_users", username);
    const adminSnap = await getDoc(adminDocRef);
    if (!adminSnap.exists()) return false;

    const adminData = adminSnap.data();
    if (!adminData) return false;

    return bcrypt.compareSync(password, adminData.passwordHash);
  } catch (err) {
    console.error("verifyAdminToken client error:", err);
    return false;
  }
}

// Seed hermann & dwayne if they don't exist in Firestore
async function seedSuperusersClient() {
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

      // --- ENDPOINT: POST /api/stream ---
      if (path === "/api/stream" && init?.method === "POST") {
        const { username, password } = body;
        if (!username || !password) {
          return jsonResponse({ error: "Nom d'utilisateur et mot de passe requis" }, 400);
        }

        const cleanUsername = username.trim().toLowerCase();

        // 1. Check if admin
        const adminDocRef = doc(db, "admin_users", cleanUsername);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          const adminData = adminSnap.data();
          if (adminData && bcrypt.compareSync(password, adminData.passwordHash)) {
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
        const userDocRef = doc(db, "iptv_users", cleanUsername);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          return jsonResponse({ error: "Identifiants incorrects" }, 401);
        }

        const userData = userSnap.data();
        if (!userData) {
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
          url: decryptedUrl
        });
      }

      // --- ENDPOINT: GET /api/admin/users ---
      if (path === "/api/admin/users" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const usersSnap = await getDocs(collection(db, "iptv_users"));
        const users: any[] = [];
        const now = Date.now();

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

        return jsonResponse(users);
      }

      // --- ENDPOINT: GET /api/admin/admins ---
      if (path === "/api/admin/admins" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const adminsSnap = await getDocs(collection(db, "admin_users"));
        const admins: any[] = [];

        adminsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          admins.push({
            username: docSnap.id,
            createdAt: data.createdAt,
            role: data.role || "admin"
          });
        });

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

        const userDocRef = doc(db, "iptv_users", cleanUsername);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          return jsonResponse({ error: `L'utilisateur "${username}" existe déjà` }, 400);
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const encryptedUrl = await encryptClient(realUrl.trim());
        const now = Date.now();
        const expiresAt = durationDays === 99999 ? now + (99999 * 24 * 60 * 60 * 1000) : now + (durationDays * 24 * 60 * 60 * 1000);

        const newUser = {
          username: cleanUsername,
          passwordHash,
          encryptedUrl,
          createdAt: now,
          expiresAt,
          durationDays,
          status: expiresAt > now ? "active" : "expired"
        };

        await setDoc(userDocRef, newUser);

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

        const userDocRef = doc(db, "iptv_users", id.toLowerCase());
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          return jsonResponse({ error: "Utilisateur non trouvé" }, 404);
        }

        await deleteDoc(userDocRef);
        return jsonResponse({ success: true, message: "Utilisateur supprimé" });
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

        const adminDocRef = doc(db, "admin_users", cleanUsername);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          return jsonResponse({ error: `L'administrateur "${username}" existe déjà` }, 400);
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        await setDoc(adminDocRef, {
          username: cleanUsername,
          passwordHash,
          createdAt: Date.now(),
          role: "admin"
        });

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

        const adminDocRef = doc(db, "admin_users", targetUsername);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) {
          return jsonResponse({ error: "Administrateur non trouvé" }, 404);
        }

        await deleteDoc(adminDocRef);
        return jsonResponse({ success: true, message: `Administrateur "${targetUsername}" supprimé.` });
      }

      // --- ENDPOINT: GET /api/admin/tickets ---
      if (path === "/api/admin/tickets" && init?.method === "GET") {
        const isAuthorized = await verifyAdminToken(token);
        if (!isAuthorized) {
          return jsonResponse({ error: "Clé ou session administrateur invalide" }, 403);
        }

        const ticketsSnap = await getDocs(collection(db, "support_tickets"));
        const tickets: any[] = [];

        ticketsSnap.forEach((docSnap) => {
          tickets.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });

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

        const ticketRef = doc(db, "support_tickets", id);
        await deleteDoc(ticketRef);
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

        const ticketRef = doc(db, "support_tickets", id);
        await updateDoc(ticketRef, { status });
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
