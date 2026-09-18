/**
 * Real Firestore REST Database Client
 * Synchronizes user balances, settings, and generation records directly into Firestore
 * using the authenticated Google Firebase user's ID token.
 */
import fs from 'node:fs';
import path from 'node:path';

let projectId = 'gen-lang-client-0660352831';
let databaseId = 'ai-studio-bd71d8c1-7b61-4372-9375-d8eade862cc9';

try {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.projectId) projectId = cfg.projectId;
    if (cfg.firestoreDatabaseId) databaseId = cfg.firestoreDatabaseId;
  }
} catch (e) {
  console.warn('Could not read Firestore config:', e);
}

function getBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      res[k] = fromFirestoreValue(fields[k]);
    }
    return res;
  }
  return null;
}

export function documentToData(doc: any): any {
  if (!doc || !doc.fields) return null;
  const data: Record<string, any> = {};
  for (const k of Object.keys(doc.fields)) {
    data[k] = fromFirestoreValue(doc.fields[k]);
  }
  return data;
}

/**
 * Reads a Firestore document using the user's ID token.
 */
export async function getFirestoreDoc(docPath: string, idToken?: string): Promise<any | null> {
  if (!idToken) return null;
  const url = `${getBaseUrl()}/${docPath.replace(/^\//, '')}`;
  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      console.warn(`Firestore GET ${docPath} status: ${resp.status}`);
      return null;
    }
    const doc = await resp.json();
    return documentToData(doc);
  } catch (err) {
    console.warn(`Firestore GET ${docPath} error:`, err);
    return null;
  }
}

/**
 * Writes or updates a Firestore document using the user's ID token.
 */
export async function setFirestoreDoc(docPath: string, data: Record<string, any>, idToken?: string): Promise<boolean> {
  if (!idToken) return false;
  const url = `${getBaseUrl()}/${docPath.replace(/^\//, '')}`;
  const fields: Record<string, any> = {};
  for (const k of Object.keys(data)) {
    fields[k] = toFirestoreValue(data[k]);
  }

  try {
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`Firestore PATCH ${docPath} status ${resp.status}:`, errText.substring(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Firestore PATCH ${docPath} error:`, err);
    return false;
  }
}
