/**
 * Vapi Knowledge Base API Client
 * https://docs.vapi.ai/knowledge-base
 *
 * Vapi KBs work through a pipeline: File upload → Knowledge Base → Query Tool → Assistant.
 * Files are uploaded separately, then referenced by ID in a knowledge base.
 * The KB is then attached to an assistant via a "query" type tool.
 */

import { fetchWithRetry } from '@/lib/retry';

const VAPI_BASE_URL = 'https://api.vapi.ai';

// ============================================
// TYPES
// ============================================

export interface VapiFile {
    id: string;
    orgId?: string;
    name: string;
    originalName?: string;
    status: 'processing' | 'done' | 'failed';
    bytes?: number;
    mimetype?: string;
    url?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface VapiKnowledgeBase {
    id: string;
    orgId?: string;
    name?: string;
    provider: string;
    model?: string;
    description?: string;
    fileIds?: string[];
    createdAt?: string;
    updatedAt?: string;
}

/** Normalized KB shape for the dashboard */
export interface NormalizedVapiKB {
    id: string;
    name: string;
    status: 'in_progress' | 'complete' | 'error';
    sources: Array<{
        source_id: string;
        source_type: 'file';
        source_name: string;
        status: string;
    }>;
}

// ============================================
// FETCH WRAPPER
// ============================================

async function vapiFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetchWithRetry(
        `${VAPI_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        },
        { onRetry: (attempt, _err, delay) => console.warn(`Vapi KB ${path} retry #${attempt} in ${delay}ms`) },
    );

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`Vapi KB API error [${response.status}] ${path}: ${errText}`);
        throw new Error(`Vapi KB API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Upload a file to Vapi via multipart/form-data.
 * Uses native fetch (not the JSON wrapper) since Content-Type must be multipart.
 */
async function vapiMultipartUpload<T>(
    apiKey: string,
    path: string,
    formData: FormData,
): Promise<T> {
    const response = await fetch(`${VAPI_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            // Do NOT set Content-Type — fetch sets it with boundary for FormData
        },
        body: formData,
        signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`Vapi upload error [${response.status}] ${path}: ${errText}`);
        throw new Error(`Vapi upload error: ${response.status}`);
    }

    return response.json();
}

// ============================================
// FILE OPERATIONS
// ============================================

export async function createVapiFile(
    apiKey: string,
    file: Blob,
    filename: string,
): Promise<VapiFile> {
    const form = new FormData();
    form.append('file', file, filename);
    return vapiMultipartUpload<VapiFile>(apiKey, '/file', form);
}

export async function listVapiFiles(apiKey: string): Promise<VapiFile[]> {
    return vapiFetch<VapiFile[]>(apiKey, '/file');
}

export async function deleteVapiFile(
    apiKey: string,
    fileId: string,
): Promise<void> {
    await vapiFetch(apiKey, `/file/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
    });
}

// ============================================
// KNOWLEDGE BASE OPERATIONS
// ============================================

export async function createVapiKnowledgeBase(
    apiKey: string,
    params: {
        name: string;
        description?: string;
        fileIds: string[];
    },
): Promise<VapiKnowledgeBase> {
    return vapiFetch<VapiKnowledgeBase>(apiKey, '/knowledge-base', {
        method: 'POST',
        body: JSON.stringify({
            name: params.name,
            provider: 'google',
            model: 'gemini-1.5-flash',
            description: params.description || `Knowledge base for ${params.name}`,
            fileIds: params.fileIds,
        }),
    });
}

export async function getVapiKnowledgeBase(
    apiKey: string,
    kbId: string,
): Promise<VapiKnowledgeBase> {
    return vapiFetch<VapiKnowledgeBase>(apiKey, `/knowledge-base/${encodeURIComponent(kbId)}`);
}

export async function listVapiKnowledgeBases(apiKey: string): Promise<VapiKnowledgeBase[]> {
    return vapiFetch<VapiKnowledgeBase[]>(apiKey, '/knowledge-base');
}

export async function updateVapiKnowledgeBase(
    apiKey: string,
    kbId: string,
    params: { fileIds?: string[]; name?: string; description?: string },
): Promise<VapiKnowledgeBase> {
    return vapiFetch<VapiKnowledgeBase>(apiKey, `/knowledge-base/${encodeURIComponent(kbId)}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}

export async function deleteVapiKnowledgeBase(
    apiKey: string,
    kbId: string,
): Promise<void> {
    await vapiFetch(apiKey, `/knowledge-base/${encodeURIComponent(kbId)}`, {
        method: 'DELETE',
    });
}

// ============================================
// NORMALIZATION
// ============================================

/**
 * Fetch a Vapi KB and its files, returning a normalized shape that
 * matches the dashboard's common KB interface.
 */
export async function getVapiKBNormalized(
    apiKey: string,
    kbId: string,
): Promise<NormalizedVapiKB> {
    const kb = await getVapiKnowledgeBase(apiKey, kbId);

    // Fetch file details for each fileId
    const files: VapiFile[] = [];
    if (kb.fileIds && kb.fileIds.length > 0) {
        const allFiles = await listVapiFiles(apiKey);
        for (const fid of kb.fileIds) {
            const f = allFiles.find(af => af.id === fid);
            if (f) files.push(f);
        }
    }

    return {
        id: kb.id,
        name: kb.name || 'Knowledge Base',
        status: files.some(f => f.status === 'processing') ? 'in_progress'
            : files.some(f => f.status === 'failed') ? 'error'
                : 'complete',
        sources: files.map(f => ({
            source_id: f.id,
            source_type: 'file' as const,
            source_name: f.originalName || f.name,
            status: f.status === 'done' ? 'complete' : f.status,
        })),
    };
}
