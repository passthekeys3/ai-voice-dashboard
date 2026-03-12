/**
 * Bland.ai Knowledge Base API Client
 * https://docs.bland.ai/api-v1/post/knowledge-learn-text
 *
 * Bland uses a unified `/v1/knowledge/learn` endpoint that accepts
 * text, file, or web scrape sources via the `type` field.
 * Each source creates its own KB entry. KBs are then attached to
 * calls/pathways via the `tools` array using `KB-{id}` prefix.
 */

import { fetchWithRetry } from '@/lib/retry';

const BLAND_BASE_URL = 'https://api.bland.ai/v1';

// ============================================
// TYPES
// ============================================

export interface BlandKnowledgeBase {
    id: string;
    name: string;
    description?: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    type?: 'TEXT' | 'FILE' | 'WEB_SCRAPE';
    error_message?: string | null;
    file?: {
        file_name?: string;
        file_size?: number;
        file_type?: string;
    };
    created_at?: string;
    updated_at?: string;
}

/** Normalized KB shape for the dashboard */
export interface NormalizedBlandKB {
    id: string;
    name: string;
    status: 'in_progress' | 'complete' | 'error';
    sources: Array<{
        source_id: string;
        source_type: 'text' | 'url' | 'file';
        source_name: string;
        source_url?: string;
        status: string;
    }>;
}

// ============================================
// FETCH WRAPPER
// ============================================

async function blandFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetchWithRetry(
        `${BLAND_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                'authorization': apiKey, // Raw key, NOT Bearer
                'Content-Type': 'application/json',
                ...options.headers,
            },
        },
        { onRetry: (attempt, _err, delay) => console.warn(`Bland KB ${path} retry #${attempt} in ${delay}ms`) },
    );

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`Bland KB API error [${response.status}] ${path}: ${errText}`);
        throw new Error(`Bland KB API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Upload a file to Bland via multipart/form-data.
 */
async function blandMultipartUpload<T>(
    apiKey: string,
    path: string,
    formData: FormData,
): Promise<T> {
    const response = await fetch(`${BLAND_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'authorization': apiKey,
            // Do NOT set Content-Type — fetch sets it with boundary for FormData
        },
        body: formData,
        signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`Bland upload error [${response.status}] ${path}: ${errText}`);
        throw new Error(`Bland upload error: ${response.status}`);
    }

    return response.json();
}

// ============================================
// KNOWLEDGE BASE OPERATIONS
// ============================================

/** Create a KB from raw text */
export async function createBlandTextKB(
    apiKey: string,
    params: { name: string; description?: string; text: string },
): Promise<BlandKnowledgeBase> {
    const result = await blandFetch<{ data: BlandKnowledgeBase }>(apiKey, '/knowledge/learn', {
        method: 'POST',
        body: JSON.stringify({
            type: 'text',
            name: params.name,
            description: params.description || '',
            text: params.text,
        }),
    });
    return result.data;
}

/** Create a KB from web scraping */
export async function createBlandWebKB(
    apiKey: string,
    params: { name: string; description?: string; urls: string[] },
): Promise<BlandKnowledgeBase> {
    const result = await blandFetch<{ data: BlandKnowledgeBase }>(apiKey, '/knowledge/learn', {
        method: 'POST',
        body: JSON.stringify({
            type: 'web',
            name: params.name,
            description: params.description || '',
            urls: params.urls,
        }),
    });
    return result.data;
}

/** Create a KB from a file upload */
export async function createBlandFileKB(
    apiKey: string,
    params: { name: string; description?: string; file: Blob; filename: string },
): Promise<BlandKnowledgeBase> {
    const form = new FormData();
    form.append('type', 'file');
    form.append('name', params.name);
    if (params.description) form.append('description', params.description);
    form.append('file', params.file, params.filename);

    const result = await blandMultipartUpload<{ data: BlandKnowledgeBase }>(
        apiKey,
        '/knowledge/learn',
        form,
    );
    return result.data;
}

/** Get a single knowledge base */
export async function getBlandKnowledgeBase(
    apiKey: string,
    kbId: string,
): Promise<BlandKnowledgeBase> {
    const result = await blandFetch<{ data: BlandKnowledgeBase }>(
        apiKey,
        `/knowledge/${encodeURIComponent(kbId)}`,
    );
    return result.data;
}

/** List all knowledge bases */
export async function listBlandKnowledgeBases(
    apiKey: string,
): Promise<BlandKnowledgeBase[]> {
    const result = await blandFetch<{ data: BlandKnowledgeBase[] }>(apiKey, '/knowledge');
    return result.data || [];
}

/** Delete a knowledge base (soft delete) */
export async function deleteBlandKnowledgeBase(
    apiKey: string,
    kbId: string,
): Promise<void> {
    await blandFetch(apiKey, `/knowledge/${encodeURIComponent(kbId)}`, {
        method: 'DELETE',
    });
}

// ============================================
// NORMALIZATION
// ============================================

/** Map Bland status to normalized status */
function normalizeBlandStatus(status: string): 'in_progress' | 'complete' | 'error' {
    switch (status) {
        case 'COMPLETED': return 'complete';
        case 'FAILED': return 'error';
        default: return 'in_progress';
    }
}

/** Map Bland KB type to source type */
function normalizeBlandType(type?: string): 'text' | 'url' | 'file' {
    switch (type) {
        case 'WEB_SCRAPE': return 'url';
        case 'FILE': return 'file';
        default: return 'text';
    }
}

/**
 * Bland stores each source as a separate KB. To present a unified KB view,
 * we list all KBs whose IDs are stored in the agent's config and merge them
 * into a single normalized response.
 */
export async function getBlandKBsNormalized(
    apiKey: string,
    kbIds: string[],
): Promise<NormalizedBlandKB> {
    const kbs: BlandKnowledgeBase[] = [];
    for (const id of kbIds) {
        try {
            const kb = await getBlandKnowledgeBase(apiKey, id);
            kbs.push(kb);
        } catch {
            // Skip KBs that no longer exist
        }
    }

    const overallStatus: NormalizedBlandKB['status'] =
        kbs.some(kb => kb.status === 'FAILED') ? 'error'
            : kbs.some(kb => kb.status === 'PROCESSING') ? 'in_progress'
                : 'complete';

    return {
        id: kbIds[0] || '',
        name: 'Knowledge Base',
        status: overallStatus,
        sources: kbs.map(kb => ({
            source_id: kb.id,
            source_type: normalizeBlandType(kb.type),
            source_name: kb.name || kb.file?.file_name || 'Untitled',
            source_url: undefined,
            status: normalizeBlandStatus(kb.status),
        })),
    };
}
