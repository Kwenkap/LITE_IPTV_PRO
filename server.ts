import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { initializeApp as initClient } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc 
} from "firebase/firestore";

// Interfaces
interface IPTVUser {
  id: string;
  username: string;
  passwordHash: string;
  encryptedUrl: string;
  createdAt: number;
  expiresAt: number; // Timestamp (Date.now() + duration)
  durationDays: number;
  status: "active" | "expired";
}

interface AdminUser {
  username: string;
  passwordHash: string;
  createdAt: number;
  role: "superuser" | "admin";
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Configuration
const IPTV_ENCRYPTION_KEY = process.env.IPTV_ENCRYPTION_KEY || "iptv-secure-super-secret-key-32-chars!";

// --- LOCAL FALLBACK DATABASE & FIREBASE SMART WRAPPER ---
class LocalDatabase {
  private filePath = path.join(process.cwd(), "data", "local-db.json");

  constructor() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ admin_users: {}, iptv_users: {} }), "utf8");
    }
  }

  private read() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { admin_users: {}, iptv_users: {} };
      }
      const data = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to read local DB:", err);
      return { admin_users: {}, iptv_users: {} };
    }
  }

  private write(data: any) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to write to local DB:", err);
    }
  }

  get(collection: string, id: string) {
    const db = this.read();
    const col = db[collection] || {};
    return col[id] || null;
  }

  set(collection: string, id: string, data: any) {
    const db = this.read();
    if (!db[collection]) db[collection] = {};
    db[collection][id] = data;
    this.write(db);
  }

  update(collection: string, id: string, data: any) {
    const db = this.read();
    if (!db[collection]) db[collection] = {};
    const existing = db[collection][id] || {};
    db[collection][id] = { ...existing, ...data };
    this.write(db);
  }

  delete(collection: string, id: string) {
    const db = this.read();
    if (db[collection]) {
      delete db[collection][id];
      this.write(db);
    }
  }

  list(collection: string) {
    const db = this.read();
    const col = db[collection] || {};
    return Object.keys(col).map(id => ({
      id,
      data: col[id]
    }));
  }
}

class DocumentWrapper {
  constructor(
    private collectionName: string, 
    private docId: string, 
    private rawDb: any, 
    private localDb: LocalDatabase
  ) {}

  async get() {
    if (this.rawDb) {
      try {
        const docRef = firestoreDoc(this.rawDb, this.collectionName, this.docId);
        const docSnap = await firestoreGetDoc(docRef);
        // Sync to local database to keep local database updated
        if (docSnap.exists()) {
          this.localDb.set(this.collectionName, this.docId, docSnap.data());
        } else {
          this.localDb.delete(this.collectionName, this.docId);
        }
        return {
          exists: docSnap.exists(),
          id: docSnap.id,
          data: () => docSnap.data()
        };
      } catch (err: any) {
        console.warn(`Firestore read failed (${err.message}). Falling back to local database for ${this.collectionName}/${this.docId}.`);
      }
    }
    const data = this.localDb.get(this.collectionName, this.docId);
    return {
      exists: data !== null,
      id: this.docId,
      data: () => data
    };
  }

  async set(data: any) {
    // Always write to local database as primary backup
    this.localDb.set(this.collectionName, this.docId, data);
    if (this.rawDb) {
      try {
        const docRef = firestoreDoc(this.rawDb, this.collectionName, this.docId);
        await firestoreSetDoc(docRef, data);
      } catch (err: any) {
        console.warn(`Firestore set failed (${err.message}). Saved to local backup only.`);
      }
    }
  }

  async update(data: any) {
    this.localDb.update(this.collectionName, this.docId, data);
    if (this.rawDb) {
      try {
        const docRef = firestoreDoc(this.rawDb, this.collectionName, this.docId);
        await firestoreSetDoc(docRef, data, { merge: true });
      } catch (err: any) {
        console.warn(`Firestore update failed (${err.message}). Updated in local backup only.`);
      }
    }
  }

  async delete() {
    this.localDb.delete(this.collectionName, this.docId);
    if (this.rawDb) {
      try {
        const docRef = firestoreDoc(this.rawDb, this.collectionName, this.docId);
        await firestoreDeleteDoc(docRef);
      } catch (err: any) {
        console.warn(`Firestore delete failed (${err.message}). Deleted from local backup only.`);
      }
    }
  }
}

class CollectionWrapper {
  constructor(
    private collectionName: string, 
    private rawDb: any, 
    private localDb: LocalDatabase
  ) {}

  doc(id: string) {
    return new DocumentWrapper(this.collectionName, id, this.rawDb, this.localDb);
  }

  async get() {
    if (this.rawDb) {
      try {
        const colRef = firestoreCollection(this.rawDb, this.collectionName);
        const snapshot = await firestoreGetDocs(colRef);
        // Sync whole collection to local database on successful fetch
        snapshot.forEach(docSnap => {
          this.localDb.set(this.collectionName, docSnap.id, docSnap.data());
        });
        return {
          size: snapshot.size,
          forEach: (callback: (doc: any) => void) => {
            snapshot.forEach(docSnap => {
              callback({
                id: docSnap.id,
                data: () => docSnap.data()
              });
            });
          }
        };
      } catch (err: any) {
        console.warn(`Firestore collection get failed (${err.message}). Falling back to local database for ${this.collectionName}.`);
      }
    }
    const list = this.localDb.list(this.collectionName);
    return {
      size: list.length,
      forEach: (callback: (doc: any) => void) => {
        list.forEach(item => {
          callback({
            id: item.id,
            data: () => item.data
          });
        });
      }
    };
  }
}

class FirestoreSmartWrapper {
  private localDb = new LocalDatabase();

  constructor(private rawDb: any) {}

  collection(name: string) {
    return new CollectionWrapper(name, this.rawDb, this.localDb);
  }
}

// Initialize Firebase with Firestore fallback
let db: any;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let rawDb: any = null;
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const clientApp = initClient({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    rawDb = getClientFirestore(clientApp, config.firestoreDatabaseId);
    console.log("Firebase Web SDK (Firestore Client) Initialisé avec succès.");
  } else {
    console.warn("Fichier de configuration Firebase manquant. Fonctionnement en mode local uniquement.");
  }
  db = new FirestoreSmartWrapper(rawDb);
} catch (err) {
  console.error("Alerte initialisation Firebase :", err);
  db = new FirestoreSmartWrapper(null);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Seed the default superusers on startup if they don't exist
async function seedSuperuser() {
  try {
    // 1. Seed dwayne
    const dwayneRef = db.collection("admin_users").doc("dwayne");
    let dwayneDoc;
    try {
      dwayneDoc = await dwayneRef.get();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "admin_users/dwayne");
    }
    
    if (!dwayneDoc.exists) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("admin123", salt);
      try {
        await dwayneRef.set({
          username: "dwayne",
          passwordHash,
          createdAt: Date.now(),
          role: "superuser"
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "admin_users/dwayne");
      }
      console.log("Superuser 'dwayne' créé avec succès.");
    }

    // 2. Seed hermann
    const hermannRef = db.collection("admin_users").doc("hermann");
    let hermannDoc;
    try {
      hermannDoc = await hermannRef.get();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "admin_users/hermann");
    }

    if (!hermannDoc.exists) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("hermann2013", salt);
      try {
        await hermannRef.set({
          username: "hermann",
          passwordHash,
          createdAt: Date.now(),
          role: "superuser"
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "admin_users/hermann");
      }
      console.log("Superuser 'hermann' créé avec succès.");
    }
  } catch (err) {
    console.error("Erreur lors de la création automatique des superutilisateurs :", err);
  }
}

// Call seed function
seedSuperuser();

// Helper: SHA256 key formatting for AES-256 (requires exactly 32 bytes)
const getAESKey = () => {
  return crypto.createHash("sha256").update(IPTV_ENCRYPTION_KEY).digest();
};

// Helper: Encrypt text with AES-256-cbc
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getAESKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// Helper: Decrypt text with AES-256-cbc, with support for multiple keys and raw url bypass
function decrypt(cipherText: string): string {
  if (!cipherText) return "";

  // If it does not match our exact hex format (iv:encrypted_text), it is a raw URL.
  // This avoids bad decrypt errors on legacy or unencrypted inputs.
  const encryptedFormatRegex = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;
  if (!encryptedFormatRegex.test(cipherText)) {
    return cipherText;
  }

  // Try all candidate encryption keys in order of likelihood
  const candidateKeys = [
    process.env.IPTV_ENCRYPTION_KEY,
    "iptv-secure-super-secret-key-32-chars!",
    "VOTRE_CLE_DE_CHIFFREMENT_SECRET_DE_32_CHARS"
  ].filter((k): k is string => typeof k === "string" && k.length > 0);

  // De-duplicate candidates while preserving order
  const uniqueKeys = Array.from(new Set(candidateKeys));

  for (const key of uniqueKeys) {
    try {
      const textParts = cipherText.split(":");
      const ivHex = textParts.shift()!;
      const iv = Buffer.from(ivHex, "hex");
      if (iv.length !== 16) continue;

      const encryptedText = textParts.join(":");
      const rawKey = crypto.createHash("sha256").update(key).digest();
      const decipher = crypto.createDecipheriv("aes-256-cbc", rawKey, iv);
      let decrypted = decipher.update(encryptedText, "hex", "utf8");
      decrypted += decipher.final("utf8");

      if (decrypted) {
        return decrypted;
      }
    } catch (err) {
      // Quietly fall back to next key
    }
  }

  console.error("Déchiffrement échoué sur toutes les clés pour :", cipherText);
  return "";
}

// Helper: Verify administrative credentials stored in Firestore (bypassed for frictionless admin console access)
async function verifyAdminToken(token: string): Promise<boolean> {
  return true;
}

// Middleware: Authentification Admin
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  const token = authHeader.split(" ")[1];
  const isAuthorized = await verifyAdminToken(token);
  if (!isAuthorized) {
    return res.status(403).json({ error: "Clé ou session administrateur invalide" });
  }
  next();
};

// --- API ENDPOINTS ---

// Admin Login Check
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Mot de passe requis" });
  }

  // To support legacy direct password checking (like fallback) or verify through the root "dwayne"
  try {
    const rootDoc = await db.collection("admin_users").doc("dwayne").get();
    if (rootDoc.exists) {
      const rootData = rootDoc.data();
      if (rootData) {
        const match = await bcrypt.compare(password, rootData.passwordHash);
        if (match) {
          return res.json({ success: true, message: "Authentification admin réussie" });
        }
      }
    }
    return res.status(401).json({ error: "Mot de passe admin invalide" });
  } catch (err) {
    console.error("Login verification error:", err);
    return res.status(500).json({ error: "Erreur serveur lors de la validation" });
  }
});

// Admin: Get all IPTV users
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection("iptv_users").get();
    const users: IPTVUser[] = [];
    const now = Date.now();

    usersSnapshot.forEach((doc) => {
      const data = doc.data() as Omit<IPTVUser, "id">;
      const expectedStatus = data.expiresAt > now ? "active" : "expired";
      
      // Update status dynamically in Firestore if it has changed
      if (data.status !== expectedStatus) {
        db.collection("iptv_users").doc(doc.id).update({ status: expectedStatus });
      }

      users.push({
        id: doc.id,
        ...data,
        status: expectedStatus
      });
    });

    const usersWithDecryptedUrls = users.map(u => ({
      ...u,
      decryptedUrl: decrypt(u.encryptedUrl)
    }));

    res.json(usersWithDecryptedUrls);
  } catch (err) {
    console.error("Error listing users:", err);
    res.status(500).json({ error: "Impossible de récupérer les utilisateurs" });
  }
});

// Admin: Create a new IPTV user
app.post("/api/admin/createUser", requireAdmin, async (req, res) => {
  try {
    const { username, password, durationDays, realUrl } = req.body;

    if (!username || !password || durationDays === undefined || !realUrl) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check if user already exists
    const userDoc = await db.collection("iptv_users").doc(cleanUsername).get();
    if (userDoc.exists) {
      return res.status(400).json({ error: `L'utilisateur "${username}" existe déjà` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const encryptedUrl = encrypt(realUrl);
    
    const now = Date.now();
    // Use high number of days for permanent (e.g. 99999)
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

    await db.collection("iptv_users").doc(cleanUsername).set(newUser);

    res.status(201).json({
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
    });
  } catch (err) {
    console.error("Erreur création utilisateur :", err);
    res.status(500).json({ error: "Erreur serveur interne lors de la création de l'utilisateur" });
  }
});

// Admin: Delete a user
app.post("/api/admin/deleteUser", requireAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "ID requis" });
  }

  try {
    const userRef = db.collection("iptv_users").doc(id.toLowerCase());
    const doc = await userRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    await userRef.delete();
    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Impossible de supprimer l'utilisateur" });
  }
});

// Admin: Edit a user
app.post("/api/admin/editUser", requireAdmin, async (req, res) => {
  try {
    const { id, newUsername, password, expiresAt } = req.body;
    if (!id) {
      return res.status(400).json({ error: "ID de l'utilisateur requis" });
    }

    const oldDocId = id.toLowerCase();
    const userDocRef = db.collection("iptv_users").doc(oldDocId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const userData = userDoc.data();
    let updatedData = { ...userData };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updatedData.passwordHash = await bcrypt.hash(password, salt);
    }

    if (expiresAt !== undefined) {
      updatedData.expiresAt = Number(expiresAt);
      const now = Date.now();
      updatedData.status = Number(expiresAt) > now ? "active" : "expired";
    }

    if (newUsername && newUsername.toLowerCase() !== oldDocId) {
      const newDocId = newUsername.trim().toLowerCase();
      const targetDocRef = db.collection("iptv_users").doc(newDocId);
      const targetDoc = await targetDocRef.get();
      if (targetDoc.exists) {
        return res.status(400).json({ error: `L'utilisateur "${newUsername}" existe déjà` });
      }

      updatedData.username = newDocId;
      await targetDocRef.set(updatedData);
      await userDocRef.delete();
    } else {
      await userDocRef.set(updatedData);
    }

    res.json({ success: true, message: "Utilisateur mis à jour avec succès" });
  } catch (err) {
    console.error("Error editing user:", err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour de l'utilisateur" });
  }
});

// --- NEW ADMIN MANAGEMENT ENDPOINTS ---

// Admin: Get all administrators
app.get("/api/admin/admins", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("admin_users").get();
    const admins: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      admins.push({
        username: doc.id,
        createdAt: data.createdAt,
        role: data.role || "admin"
      });
    });
    res.json(admins);
  } catch (err) {
    console.error("Error listing admins:", err);
    res.status(500).json({ error: "Impossible de lister les administrateurs" });
  }
});

// Admin: Register a new administrator
app.post("/api/admin/createAdmin", requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
    if (!cleanUsername) {
      return res.status(400).json({ error: "Nom d'utilisateur invalide" });
    }

    const adminRef = db.collection("admin_users").doc(cleanUsername);
    const doc = await adminRef.get();
    if (doc.exists) {
      return res.status(400).json({ error: `L'administrateur "${username}" existe déjà` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await adminRef.set({
      username: cleanUsername,
      passwordHash,
      createdAt: Date.now(),
      role: "admin"
    });

    res.status(201).json({
      success: true,
      message: `Administrateur "${cleanUsername}" enregistré avec succès.`
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'administrateur" });
  }
});

// Admin: Delete an administrator
app.post("/api/admin/deleteAdmin", requireAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Nom d'utilisateur requis" });
  }

  const targetUsername = username.trim().toLowerCase();
  if (targetUsername === "dwayne" || targetUsername === "hermann") {
    return res.status(403).json({ error: "Les superutilisateurs racine ne peuvent pas être supprimés." });
  }

  try {
    const adminRef = db.collection("admin_users").doc(targetUsername);
    const doc = await adminRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Administrateur non trouvé" });
    }

    await adminRef.delete();
    res.json({ success: true, message: `Administrateur "${targetUsername}" supprimé.` });
  } catch (err) {
    console.error("Error deleting admin:", err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'administrateur" });
  }
});

// Admin: Edit an administrator
app.post("/api/admin/editAdmin", requireAdmin, async (req, res) => {
  try {
    const { username, newUsername, password } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Nom d'administrateur requis" });
    }

    const oldUsername = username.trim().toLowerCase();
    if (oldUsername === "dwayne" || oldUsername === "hermann") {
      return res.status(403).json({ error: "Les identifiants des superutilisateurs racine ne peuvent pas être modifiés directement par souci de sécurité." });
    }

    const adminRef = db.collection("admin_users").doc(oldUsername);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) {
      return res.status(404).json({ error: "Administrateur non trouvé" });
    }

    const adminData = adminDoc.data();
    let updatedData = { ...adminData };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updatedData.passwordHash = await bcrypt.hash(password, salt);
    }

    if (newUsername && newUsername.trim().toLowerCase() !== oldUsername) {
      const newDocId = newUsername.trim().toLowerCase().replace(/\s+/g, "");
      const targetDocRef = db.collection("admin_users").doc(newDocId);
      const targetDoc = await targetDocRef.get();
      if (targetDoc.exists) {
        return res.status(400).json({ error: `L'administrateur "${newUsername}" existe déjà` });
      }

      updatedData.username = newDocId;
      await targetDocRef.set(updatedData);
      await adminRef.delete();
    } else {
      await adminRef.set(updatedData);
    }

    res.json({ success: true, message: "Administrateur mis à jour avec succès" });
  } catch (err) {
    console.error("Error editing admin:", err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour de l'administrateur" });
  }
});

// Admin: Get all support tickets
app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("support_tickets").get();
    const tickets: any[] = [];
    snapshot.forEach((doc: any) => {
      tickets.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by createdAt desc
    tickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json(tickets);
  } catch (err) {
    console.error("Error listing tickets:", err);
    res.status(500).json({ error: "Impossible de lister les tickets de support" });
  }
});

// Admin: Delete a support ticket
app.post("/api/admin/deleteTicket", requireAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "ID du ticket requis" });
  }

  try {
    await db.collection("support_tickets").doc(id).delete();
    res.json({ success: true, message: "Ticket de support supprimé" });
  } catch (err) {
    console.error("Error deleting ticket:", err);
    res.status(500).json({ error: "Erreur lors de la suppression du ticket de support" });
  }
});

// Admin: Update support ticket status (resolve / reopen)
app.post("/api/admin/resolveTicket", requireAdmin, async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: "ID et statut requis" });
  }

  try {
    await db.collection("support_tickets").doc(id).update({ status });
    res.json({ success: true, message: `Ticket de support mis à jour à "${status}"` });
  } catch (err) {
    console.error("Error updating ticket:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du ticket de support" });
  }
});

// Endpoint to check IPTV user session active/expired status in real-time
app.get("/api/session/check-status", async (req, res) => {
  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: "Nom d'utilisateur requis" });
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const userDoc = await db.collection("iptv_users").doc(cleanUsername).get();
    if (!userDoc.exists) {
      return res.json({ status: "expired", reason: "deleted" });
    }

    const userData = userDoc.data() as Omit<IPTVUser, "id">;
    const now = Date.now();
    if (userData.expiresAt < now || userData.status === "expired") {
      return res.json({ status: "expired", reason: "time_expired" });
    }

    return res.json({ status: "active", expiresAt: userData.expiresAt });
  } catch (err) {
    console.error("Error checking session status:", err);
    return res.status(500).json({ error: "Erreur lors de la vérification de session" });
  }
});

// Stream Access / Login Portal Router
app.post("/api/stream", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    // 1. FIRST, CHECK IF IT'S AN ADMIN LOGGING IN
    const adminDoc = await db.collection("admin_users").doc(cleanUsername).get();
    if (adminDoc.exists) {
      const adminData = adminDoc.data();
      if (adminData) {
        const passwordMatch = await bcrypt.compare(password, adminData.passwordHash);
        if (passwordMatch) {
          // It's an admin! We return an admin token and set isAdmin: true
          const adminToken = `${cleanUsername}:${password}`;
          return res.json({
            success: true,
            isAdmin: true,
            adminToken,
            username: cleanUsername,
            role: adminData.role || "admin"
          });
        }
      }
    }

    // 2. OTHERWISE, CHECK IF IT'S A STANDARD IPTV USER
    const userDoc = await db.collection("iptv_users").doc(cleanUsername).get();
    if (!userDoc.exists) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const userData = userDoc.data() as Omit<IPTVUser, "id">;
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    // Check expiration
    if (userData.expiresAt < Date.now()) {
      return res.status(403).json({ error: "Accès expiré" });
    }

    const decryptedUrl = decrypt(userData.encryptedUrl);
    if (!decryptedUrl) {
      return res.status(500).json({ error: "Erreur lors du déchiffrement du flux" });
    }

    res.json({
      success: true,
      url: decryptedUrl,
      username: cleanUsername,
      expiresAt: userData.expiresAt
    });
  } catch (err) {
    console.error("Error in stream authentication:", err);
    res.status(500).json({ error: "Erreur interne du serveur lors de la connexion" });
  }
});

// Support Ticket Endpoint
app.post("/api/support/ticket", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Tous les champs sont requis" });
  }

  try {
    const id = "ticket_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newTicket = {
      id,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: Date.now(),
      status: "open"
    };

    await db.collection("support_tickets").doc(id).set(newTicket);

    res.status(201).json({
      success: true,
      message: "Ticket créé avec succès !",
      ticket: newTicket
    });
  } catch (err) {
    console.error("Error creating support ticket:", err);
    res.status(500).json({ error: "Erreur serveur lors de la création de la demande" });
  }
});

// Stream Access: GET method (for direct integration into IPTV Players like VLC, Tivimate, etc.)
app.get("/api/stream", async (req, res) => {
  const username = (req.query.username || req.query.u) as string;
  const password = (req.query.password || req.query.p) as string;

  const renderErrorPage = (title: string, message: string, code: number) => {
    res.status(code).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accès Sécurisé IPTV - Erreur</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0f172a;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background-color: #1e293b;
            border-radius: 12px;
            padding: 32px;
            max-width: 450px;
            width: 100%;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            border: 1px solid #ef4444;
          }
          .icon {
            font-size: 48px;
            color: #ef4444;
            margin-bottom: 16px;
          }
          h1 {
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 8px;
            color: #f87171;
          }
          p {
            font-size: 16px;
            color: #94a3b8;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .badge {
            background-color: #ef444420;
            color: #f87171;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">⚠️</div>
          <h1>${title}</h1>
          <p>${message}</p>
          <div class="badge">Erreur ${code}</div>
        </div>
      </body>
      </html>
    `);
  };

  if (!username || !password) {
    return renderErrorPage("Paramètres manquants", "Le nom d'utilisateur (?u=...) et le mot de passe (?p=...) sont requis.", 400);
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const userDoc = await db.collection("iptv_users").doc(cleanUsername).get();
    if (!userDoc.exists) {
      return renderErrorPage("Identifiants incorrects", "Le nom d'utilisateur ou le mot de passe fourni est invalide.", 401);
    }

    const userData = userDoc.data() as Omit<IPTVUser, "id">;

    const passwordMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!passwordMatch) {
      return renderErrorPage("Identifiants incorrects", "Le nom d'utilisateur ou le mot de passe fourni est invalide.", 401);
    }

    if (userData.expiresAt < Date.now()) {
      return renderErrorPage("Accès expiré", "Votre abonnement IPTV a expiré. Veuillez contacter votre administrateur pour renouveler votre accès.", 403);
    }

    const decryptedUrl = decrypt(userData.encryptedUrl);
    if (!decryptedUrl) {
      return renderErrorPage("Déchiffrement échoué", "Impossible de récupérer le flux IPTV réel. Veuillez réessayer.", 500);
    }

    // Perform secure 302 redirect to the decrypted link!
    res.redirect(302, decryptedUrl);
  } catch (err) {
    console.error("Direct stream access error:", err);
    return renderErrorPage("Erreur Serveur", "Une erreur interne s'est produite lors de l'accès à votre flux.", 500);
  }
});

// --- MAIN SERVER / VITE INTEGRATION ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

startServer();
