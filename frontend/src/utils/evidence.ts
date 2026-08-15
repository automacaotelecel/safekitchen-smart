import { api, uploadToSignedUrl } from '../api/client';
import type { StoredDocument } from '../types';

export type StorageInfo = {
  enabled: boolean;
  maxDocumentBytes: number;
};

export async function uploadEvidenceDocument(input: {
  file: File;
  name: string;
  category: string;
  notes?: string | null;
}) {
  const signed = await api<{
    uploadUrl: string;
    storageKey: string;
    headers: Record<string, string>;
  }>('/api/documents/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
    }),
  });

  await uploadToSignedUrl(signed.uploadUrl, input.file, signed.headers);

  return api<StoredDocument>('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      category: input.category,
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
      storageKey: signed.storageKey,
      reminderDays: 30,
      notes: input.notes || null,
    }),
  });
}

export async function openEvidenceDocument(documentId: string) {
  const data = await api<{ url: string }>(`/api/documents/${documentId}/download-url`);
  window.open(data.url, '_blank', 'noopener,noreferrer');
}

export function validateEvidenceFile(file: File, storage: StorageInfo) {
  if (!storage.enabled) {
    throw new Error('Configure o armazenamento de arquivos antes de anexar evidências.');
  }

  if (storage.maxDocumentBytes && file.size > storage.maxDocumentBytes) {
    throw new Error(
      `O arquivo excede o limite de ${Math.round(storage.maxDocumentBytes / 1024 / 1024)} MB.`
    );
  }
}

