
const API_URL = process.env.API_URL || '/api';

// --- Generic Helper ---

const strapiRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error ${endpoint}:`, response.status, errorText);
            throw new Error(`API Error ${response.status}: ${response.statusText}`);
        }

        if (response.status === 204) {
            return null;
        }

        const text = await response.text();
        if (!text) return null; // Handle empty body

        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn('Failed to parse JSON response:', text);
            return null;
        }
    } catch (error) {
        console.error(`Request failed: ${endpoint}`, error);
        throw error;
    }
};

// --- Users ---

export const fetchUsers = async () => {
    try {
        const data = await strapiRequest('/users?populate=*');
        return data;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
};

export const fetchRoles = async () => {
    try {
        const data = await strapiRequest('/users-permissions/roles');
        return data.roles || data;
    } catch (error) {
        console.error('Error fetching roles:', error);
        return [];
    }
};

export const checkBackendConnection = async () => {
    try {
        const response = await fetch(`${API_URL}/users?pagination[limit]=1`);
        return response.ok;
    } catch (error) {
        return false;
    }
};

export const updateUser = async (userId: string, data: any) => {
    return strapiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const createUser = async (data: any) => {
    return strapiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const deleteUser = async (userId: string | number) => {
    return strapiRequest(`/users/${userId}`, {
        method: 'DELETE',
    });
};

// --- Logging ---

export const createLog = async (action: string, actor: string, details: string, entityId?: string) => {
    try {
        await strapiRequest('/audit-logs', {
            method: 'POST',
            body: JSON.stringify({
                data: {
                    action,
                    actor,
                    details,
                    entity_id: entityId || '',
                    publishedAt: new Date().toISOString() // Auto publish
                }
            })
        });
    } catch (e) {
        console.error("Failed to write log", e);
    }
};

// --- Categories (Generic CRUD) ---

// Helper to unwrap Strapi response (v4/v5 structure: { data: [{ id, attributes: ... }] } or { data: [...] })
// For v5, simplified API returns { data: [...] } usually, or just [...] for some plugins.
// We'll normalize to array of objects with 'id'.
const normalizeStrapiList = (response: any) => {
    if (Array.isArray(response)) return response;
    if (response?.data && Array.isArray(response.data)) {
        const items = response.data.map((item: any) => ({
            ...item,
            ...(item.attributes || {}),
            strapiId: item.id,
            id: item.documentId || item.id,
        }));

        // Deduplicate by id (which is either documentId or numeric id)
        const uniqueItems = Array.from(new Map(items.map((item: any) => [item.id, item])).values());
        return uniqueItems;
    }
    return [];
};

// Normalize single item
export const normalizeStrapiItem = (item: any) => {
    if (!item) return null;
    const attributes = item.attributes || item;
    const id = item.documentId || item.id;

    // Create a normalized copy
    const normalized = {
        ...attributes,
        id: id,
        strapiId: item.id
    };

    // Note: Recursive normalization for relations can be complex here, 
    // so we'll handle specific mapping in the views where we know the structure.
    return normalized;
};

export const fetchCategory = async (collectionName: string) => {
    let endpoint = `/${collectionName}`;

    if (collectionName === 'users' || collectionName.startsWith('users?')) {
        const json = await strapiRequest(endpoint);
        return normalizeStrapiList(json);
    }

    const defaultParams = 'populate=*&pagination[pageSize]=1000&publicationState=preview';

    // Check if collectionName already has query params
    if (collectionName.includes('?')) {
        // If it has query params but no pagination [pageSize], add a large one
        if (!collectionName.includes('pagination[pageSize]')) {
            endpoint += '&pagination[pageSize]=1000';
        }
        // If it has query params but no publicationState, add preview
        if (!collectionName.includes('publicationState')) {
            endpoint += '&publicationState=preview';
        }
    } else {
        // Default behavior for simple collection names
        endpoint += `?${defaultParams}`;
    }

    const json = await strapiRequest(endpoint);
    return normalizeStrapiList(json);
};

export const fetchItem = async (collectionName: string, id: string | number) => {
    const endpoint = `/${collectionName}/${id}?populate=*`;
    const json = await strapiRequest(endpoint);
    // Strapi v5 returns { data: { id, documentId, ...fields }, meta: {} }
    // We need to normalize the .data part, not the whole response
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const createCategory = async (collectionName: string, data: any) => {
    const payload = {
        data: {
            ...data,
            // locale: 'en', // Removed as i18n is disabled in backend
            publishedAt: new Date().toISOString()
        }
    };
    console.log(`[API] Creating ${collectionName}`, payload);
    const json = await strapiRequest(`/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const updateCategory = async (collectionName: string, id: string, data: any) => {
    const payload = { data };
    console.log(`[API] Updating ${collectionName}/${id}`, payload);
    const json = await strapiRequest(`/${collectionName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const publishDocument = async (collectionName: string, id: string) => {
    try {
        const json = await strapiRequest(`/${collectionName}/${id}/actions/publish`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
        return normalizeStrapiItem(json);
    } catch (error) {
        console.warn(`[API] Publish not needed or failed for ${collectionName}/${id}`, error);
        return null;
    }
};


export const deleteCategory = async (collectionName: string, id: string) => {
    console.log(`[API] Deleting ${collectionName}/${id}`);
    const json = await strapiRequest(`/${collectionName}/${id}`, {
        method: 'DELETE',
    });
    return normalizeStrapiItem(json);
};

// Mapping for collection names
export const COLLECTIONS = {
    NATIONS: 'nations',
    SUPPLIERS: 'suppliers',
    CLASSROOMS: 'classrooms',
    CLASSES: 'school-classes', // Note: mapped from 'classes' in frontend
    SUBJECTS: 'subjects',
    TEACHERS: 'teachers',
    STUDENTS: 'students',
    CLASS_DECISIONS: 'class-decisions',
    TRAINING_ASSIGNMENTS: 'training-assignments',
    EXAM_APPROVALS: 'exam-approvals',
    EXAM_GRADES: 'exam-grades',
    STUDENT_DOCUMENTS: 'student-documents',
    AUDIT_LOGS: 'audit-logs',
    PRINT_TEMPLATES: 'print-templates'
};
