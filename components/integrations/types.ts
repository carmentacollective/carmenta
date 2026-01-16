/**
 * Status message shown inline in integration cards
 */
export interface StatusMessage {
    type: "success" | "error";
    text: string;
    /** Used by multi-account cards to associate message with specific account */
    accountId?: string;
}
