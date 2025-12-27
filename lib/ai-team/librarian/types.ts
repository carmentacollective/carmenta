/**
 * Type definitions for the Knowledge Librarian agent
 */

/**
 * Tool input/output types
 */

export interface ListKnowledgeInput {
    userId: string;
}

export interface ListKnowledgeOutput {
    documents: Array<{
        path: string;
        name: string;
        description: string | null;
        content: string;
    }>;
}

export interface ReadDocumentInput {
    userId: string;
    path: string;
}

export interface ReadDocumentOutput {
    found: boolean;
    document?: {
        path: string;
        name: string;
        description: string | null;
        content: string;
    };
}

export interface CreateDocumentInput {
    userId: string;
    path: string;
    name: string;
    content: string;
    description?: string;
}

export interface CreateDocumentOutput {
    success: boolean;
    path: string;
    message: string;
}

export interface UpdateDocumentInput {
    userId: string;
    path: string;
    content: string;
}

export interface UpdateDocumentOutput {
    success: boolean;
    message: string;
}

export interface AppendToDocumentInput {
    userId: string;
    path: string;
    content: string;
}

export interface AppendToDocumentOutput {
    success: boolean;
    message: string;
}

export interface MoveDocumentInput {
    userId: string;
    fromPath: string;
    toPath: string;
}

export interface MoveDocumentOutput {
    success: boolean;
    message: string;
}

export interface NotifyUserInput {
    userId: string;
    message: string;
}

export interface NotifyUserOutput {
    success: boolean;
    message: string;
}

export interface CompleteExtractionOutput {
    acknowledged: boolean;
    summary: string;
}
