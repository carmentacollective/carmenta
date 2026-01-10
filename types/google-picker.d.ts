/**
 * TypeScript declarations for Google Picker API
 *
 * @see https://developers.google.com/drive/picker/reference
 */

declare namespace google.picker {
    /**
     * Actions that can be taken by the user in the picker
     */
    enum Action {
        CANCEL = "cancel",
        PICKED = "picked",
    }

    /**
     * Feature flags for picker configuration
     */
    enum Feature {
        /** Allow multiple file selection */
        MULTISELECT_ENABLED = "multiSelect",
        /** Enable navigation to shared drives */
        SUPPORT_DRIVES = "supportDrives",
    }

    /**
     * Pre-defined views for the picker
     */
    enum ViewId {
        DOCS = "all",
        DOCS_IMAGES = "docs-images",
        DOCS_IMAGES_AND_VIDEOS = "docs-images-and-videos",
        DOCS_VIDEOS = "docs-videos",
        DOCUMENTS = "documents",
        DRAWINGS = "drawings",
        FOLDERS = "folders",
        FORMS = "forms",
        PDFS = "pdfs",
        PRESENTATIONS = "presentations",
        SPREADSHEETS = "spreadsheets",
    }

    /**
     * Document metadata returned by the picker
     */
    interface Document {
        /** File ID */
        id: string;
        /** Service ID (e.g., "docs") */
        serviceId: string;
        /** MIME type of the file */
        mimeType: string;
        /** File name */
        name: string;
        /** File type */
        type: string;
        /** Last edited time (UTC timestamp) */
        lastEditedUtc: number;
        /** File icon URL */
        iconUrl: string;
        /** File description */
        description?: string;
        /** URL to open the file */
        url: string;
        /** URL to embed the file */
        embedUrl?: string;
        /** File size in bytes */
        sizeBytes?: number;
        /** Parent folder IDs */
        parentId?: string;
    }

    /**
     * Response object passed to the picker callback
     */
    interface ResponseObject {
        /** Action taken by the user */
        action: Action;
        /** Array of selected documents (only present when action is PICKED) */
        docs: Document[];
        /** Parent folder (for UPLOAD view) */
        parents?: Array<{ id: string }>;
    }

    /**
     * Callback function type for picker events
     */
    type PickerCallback = (data: ResponseObject) => void;

    /**
     * DocsView - Configurable view for Google Drive files
     */
    class DocsView {
        constructor(viewId?: ViewId);
        /** Enable folder navigation */
        setIncludeFolders(include: boolean): DocsView;
        /** Filter by MIME types (comma-separated) */
        setMimeTypes(mimeTypes: string): DocsView;
        /** Set parent folder to start browsing from */
        setParent(folderId: string): DocsView;
        /** Filter to starred files only */
        setStarred(starred: boolean): DocsView;
        /** Show owned files by default */
        setOwnedByMe(ownedByMe: boolean): DocsView;
        /** Set selection mode */
        setSelectFolderEnabled(enabled: boolean): DocsView;
        /** Set view mode */
        setMode(mode: DocsViewMode): DocsView;
    }

    /**
     * DocsView mode options
     */
    enum DocsViewMode {
        GRID = "grid",
        LIST = "list",
    }

    /**
     * Builder class for constructing a picker
     */
    class PickerBuilder {
        constructor();
        /** Set the OAuth token for accessing user's files */
        setOAuthToken(token: string): PickerBuilder;
        /** Set the API developer key */
        setDeveloperKey(key: string): PickerBuilder;
        /** Set the callback for picker events */
        setCallback(callback: PickerCallback): PickerBuilder;
        /** Add a view to the picker */
        addView(view: DocsView | ViewId): PickerBuilder;
        /** Enable a feature */
        enableFeature(feature: Feature): PickerBuilder;
        /** Disable a feature */
        disableFeature(feature: Feature): PickerBuilder;
        /** Set the title of the picker dialog */
        setTitle(title: string): PickerBuilder;
        /** Set the origin (for cross-origin iframes) */
        setOrigin(origin: string): PickerBuilder;
        /** Set the app ID */
        setAppId(appId: string): PickerBuilder;
        /** Set the locale */
        setLocale(locale: string): PickerBuilder;
        /** Build the picker */
        build(): Picker;
    }

    /**
     * The picker instance
     */
    interface Picker {
        /** Show the picker */
        setVisible(visible: boolean): void;
        /** Dispose of the picker */
        dispose(): void;
    }
}

/**
 * Google API loader
 */
declare const gapi: {
    /** Load with simple callback */
    load(api: string, callback: () => void): void;
    /** Load with config object for error handling */
    load(
        api: string,
        config: {
            callback: () => void;
            onerror?: () => void;
            timeout?: number;
            ontimeout?: () => void;
        }
    ): void;
};
