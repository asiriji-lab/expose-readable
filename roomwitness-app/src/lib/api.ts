import { mockDocsResult, mockResult } from './fixtures';
import type { AnalyzeForm, ApiError, FullAnalysis, GenerateDocsForm, GenerateDocsResult } from './types';

// Config — set via env (see .env.example). Defaults to mock so the app runs with no backend.
// USE_MOCK is true unless EXPO_PUBLIC_USE_MOCK is explicitly "false".
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:5001';

// The pipeline can take minutes; give the request generous headroom but still fail loudly.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/** POST helper: applies a timeout, normalizes errors to `{ error }`, returns parsed JSON. */
async function postForm<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${path}`, { method: 'POST', body, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('คำขอใช้เวลานานเกินไป · Request timed out');
    }
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ · Could not reach the server');
  } finally {
    clearTimeout(timer);
  }

  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง · Invalid server response (${r.status})`);
  }

  const err = (data as ApiError)?.error;
  if (!r.ok || err) throw new Error(err ?? r.statusText);
  return data as T;
}

export async function analyze(form: AnalyzeForm): Promise<FullAnalysis> {
  if (USE_MOCK) {
    await new Promise((res) => setTimeout(res, 2500));
    return mockResult;
  }
  const fd = new FormData();
  fd.append('claims', JSON.stringify(form.claims));
  if (form.moveIn)
    fd.append('move_in_image', { uri: form.moveIn.uri, name: 'move_in.jpg', type: 'image/jpeg' } as any);
  if (form.moveOut)
    fd.append('move_out_image', { uri: form.moveOut.uri, name: 'move_out.jpg', type: 'image/jpeg' } as any);
  form.screenshots?.forEach((s, i) =>
    fd.append('screenshots', { uri: s.uri, name: `ss_${i}.jpg`, type: 'image/jpeg' } as any)
  );
  fd.append('contract_clause', form.contractClause ?? '');
  fd.append('manual_landlord_promises', form.landlordPromises ?? '');
  fd.append('manual_tenant_promises', form.tenantPromises ?? '');
  return postForm<FullAnalysis>('/full-analysis', fd);
}

/**
 * POST /generate-documents — Agent 04 document generation.
 * NOTE: the backend route does not exist yet (only agent04_doc_generator/ logic does);
 * see API_CONTRACT.md. Until then this returns mocked docs.
 */
export async function generateDocuments(input: GenerateDocsForm): Promise<GenerateDocsResult> {
  if (USE_MOCK) {
    await new Promise((res) => setTimeout(res, 1500));
    return mockDocsResult;
  }
  return postForm<GenerateDocsResult>('/generate-documents', JSON.stringify(input), {
    'Content-Type': 'application/json',
  });
}
