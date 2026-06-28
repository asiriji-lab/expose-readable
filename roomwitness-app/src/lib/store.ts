import { create } from 'zustand';
import type { AnalyzeForm, DocsDetails, FullAnalysis, GenerateDocsResult } from './types';

interface Store {
  form: AnalyzeForm | null;
  result: FullAnalysis | null;
  docsDetails: DocsDetails | null;
  docsResult: GenerateDocsResult | null;
  setForm: (form: AnalyzeForm) => void;
  setResult: (result: FullAnalysis) => void;
  setDocsDetails: (docsDetails: DocsDetails) => void;
  setDocsResult: (docsResult: GenerateDocsResult) => void;
}

export const useStore = create<Store>((set) => ({
  form: null,
  result: null,
  docsDetails: null,
  docsResult: null,
  setForm: (form) => set({ form }),
  setResult: (result) => set({ result }),
  setDocsDetails: (docsDetails) => set({ docsDetails }),
  setDocsResult: (docsResult) => set({ docsResult }),
}));
