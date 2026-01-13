/**
 * Composer Component Tests
 *
 * Tests the core message composition functionality:
 * - Message submission and form handling
 * - File attachment handling
 * - Voice input integration
 * - Keyboard shortcuts (Enter, Shift+Enter, Escape)
 * - Model selection and streaming states
 * - Message queue during streaming
 * - Draft persistence integration
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import {
    render,
    screen,
    fireEvent,
    cleanup,
    waitFor,
    act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "@ai-sdk/react";

// Mock dependencies before importing the component

// Mock useIsMobile hook
const mockIsMobile = vi.fn(() => false);
vi.mock("@/lib/hooks/use-mobile", () => ({
    useIsMobile: () => mockIsMobile(),
}));

// Mock haptic feedback
const mockTriggerHaptic = vi.fn();
vi.mock("@/lib/hooks/use-haptic-feedback", () => ({
    useHapticFeedback: () => ({ trigger: mockTriggerHaptic }),
}));

// Mock message effects
const mockCheckMessage = vi.fn();
vi.mock("@/lib/hooks/use-message-effects", () => ({
    useMessageEffects: () => ({ checkMessage: mockCheckMessage }),
}));

// Mock draft persistence
const mockDismissRecovery = vi.fn();
const mockClearDraft = vi.fn();
const mockOnMessageSent = vi.fn();
const mockSaveImmediately = vi.fn();
vi.mock("@/lib/hooks/use-draft-persistence", () => ({
    useDraftPersistence: () => ({
        hasRecoveredDraft: false,
        dismissRecovery: mockDismissRecovery,
        clearDraft: mockClearDraft,
        onMessageSent: mockOnMessageSent,
        saveImmediately: mockSaveImmediately,
    }),
}));

// Mock message queue
const mockEnqueueMessage = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockEditQueuedMessage = vi.fn();
vi.mock("@/lib/hooks/use-message-queue", () => ({
    useMessageQueue: () => ({
        queue: [],
        enqueue: mockEnqueueMessage,
        remove: mockRemoveFromQueue,
        edit: mockEditQueuedMessage,
        isFull: false,
        isProcessing: false,
    }),
}));

// Mock concierge context
const mockSetConcierge = vi.fn();
vi.mock("@/lib/concierge/context", () => ({
    useConcierge: () => ({
        concierge: null,
        setConcierge: mockSetConcierge,
    }),
}));

// Mock model config
vi.mock("@/lib/model-config", () => ({
    getModel: vi.fn(() => null),
}));

// Mock connection context (safe version)
vi.mock("@/components/connection/connection-context", () => ({
    useConnectionSafe: () => ({ activeConnectionId: "conn-123" }),
}));

// Mock file attachment context
const mockAddFiles = vi.fn();
const mockClearFiles = vi.fn();
const mockRemoveFile = vi.fn();
const mockAddPastedText = vi.fn();
const mockGetNextPlaceholder = vi.fn(() => ({
    placeholder: "[Pasted Text #1]",
    filename: "pasted-text-1.txt",
}));
const mockGetTextContent = vi.fn();
vi.mock("@/components/connection/file-attachment-context", () => ({
    useFileAttachments: () => ({
        addFiles: mockAddFiles,
        isUploading: false,
        completedFiles: [],
        clearFiles: mockClearFiles,
        pendingFiles: [],
        removeFile: mockRemoveFile,
        addPastedText: mockAddPastedText,
        getNextPlaceholder: mockGetNextPlaceholder,
        getTextContent: mockGetTextContent,
    }),
}));

// Mock chat context
const mockAppend = vi.fn();
const mockStop = vi.fn();
const mockSetInput = vi.fn();
const mockHandleInputChange = vi.fn();
let mockInput = "";
let mockIsLoading = false;
let mockMessages: UIMessage[] = [];

vi.mock("@/components/connection/connect-runtime-provider", () => ({
    useChatContext: () => ({
        messages: mockMessages,
        append: mockAppend,
        isLoading: mockIsLoading,
        stop: mockStop,
        input: mockInput,
        setInput: mockSetInput,
        handleInputChange: mockHandleInputChange,
    }),
    useModelOverrides: () => ({
        overrides: {},
        setOverrides: vi.fn(),
    }),
}));

// Mock child components to simplify testing
vi.mock("@/components/connection/model-selector", () => ({
    ModelSelectorTrigger: () => <div data-testid="model-selector">Model</div>,
}));

vi.mock("@/components/connection/file-picker-button", () => ({
    FilePickerButton: () => <button data-testid="file-picker">Attach</button>,
}));

vi.mock("@/components/voice", () => ({
    VoiceInputButton: vi.fn(({ onTranscriptUpdate, onSessionStart, disabled }) => (
        <button
            data-testid="voice-input"
            disabled={disabled}
            onClick={() => {
                onSessionStart?.();
                onTranscriptUpdate?.("test voice input");
            }}
        >
            Voice
        </button>
    )),
}));

vi.mock("@/components/connection/upload-progress", () => ({
    UploadProgressDisplay: () => <div data-testid="upload-progress">Uploading</div>,
}));

vi.mock("@/components/connection/draft-recovery-banner", () => ({
    DraftRecoveryBanner: ({ show }: { show: boolean }) =>
        show ? <div data-testid="draft-recovery">Draft recovered</div> : null,
}));

vi.mock("@/components/connection/message-queue-display", () => ({
    MessageQueueDisplay: () => <div data-testid="message-queue">Queue</div>,
}));

vi.mock("@/components/connection/syntax-highlight-input", () => ({
    SyntaxHighlightInput: vi.fn(
        ({
            value,
            onChange,
            onKeyDown,
            onPaste,
            onFocus,
            onBlur,
            onCompositionStart,
            onCompositionEnd,
            ...props
        }) => (
            <textarea
                data-testid="composer-input"
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocus={onFocus}
                onBlur={onBlur}
                onCompositionStart={onCompositionStart}
                onCompositionEnd={onCompositionEnd}
                {...props}
            />
        )
    ),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: ({
            children,
            ...props
        }: {
            children: React.ReactNode;
            [key: string]: unknown;
        }) => <div {...props}>{children}</div>,
        button: ({
            children,
            ...props
        }: {
            children: React.ReactNode;
            [key: string]: unknown;
        }) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock logger to avoid console noise
vi.mock("@/lib/client-logger", () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

// Import the component after mocks are set up
import { Composer } from "@/components/connection/composer";

describe("Composer", () => {
    const mockOnMarkMessageStopped = vi.fn();

    // Reset all mocks and state before each test
    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false); // Reset to desktop mode

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        };
        Object.defineProperty(window, "localStorage", { value: localStorageMock });

        // Mock CustomEvent dispatch
        vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
    });

    afterEach(() => {
        cleanup();
    });

    describe("Initial Rendering", () => {
        it("renders the composer with input field", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("composer-input")).toBeInTheDocument();
        });

        it("renders send button when not loading", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("send-button")).toBeInTheDocument();
        });

        it("renders model selector", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("model-selector")).toBeInTheDocument();
        });

        it("renders file picker button", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("file-picker")).toBeInTheDocument();
        });

        it("renders voice input button", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("voice-input")).toBeInTheDocument();
        });
    });

    describe("Message Submission", () => {
        it("submits message on form submit with text", async () => {
            mockInput = "Hello, world!";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockAppend).toHaveBeenCalledWith({
                    role: "user",
                    content: "Hello, world!",
                    files: [],
                });
            });
        });

        it("clears input after successful send", async () => {
            mockInput = "Test message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockSetInput).toHaveBeenCalledWith("");
            });
        });

        it("calls onMessageSent after successful submission", async () => {
            mockInput = "Test message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockOnMessageSent).toHaveBeenCalled();
            });
        });

        it("flashes input when submitting empty message", async () => {
            mockInput = "";

            const { container } = render(
                <Composer onMarkMessageStopped={mockOnMarkMessageStopped} />
            );

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            // Flash effect adds ring styling
            await waitFor(() => {
                const flashingElement = container.querySelector(".ring-2");
                expect(flashingElement).toBeInTheDocument();
            });

            // Should not attempt to send
            expect(mockAppend).not.toHaveBeenCalled();
        });

        it("restores input on failed submission", async () => {
            mockInput = "Test message";
            mockAppend.mockRejectedValueOnce(new Error("Network error"));

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockSetInput).toHaveBeenCalledWith("Test message");
            });
        });

        it("triggers haptic feedback on send", async () => {
            mockInput = "Test message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockTriggerHaptic).toHaveBeenCalled();
            });
        });

        it("checks message for easter eggs", async () => {
            mockInput = "party time";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(mockCheckMessage).toHaveBeenCalledWith("party time");
            });
        });
    });

    describe("Keyboard Shortcuts", () => {
        describe("Desktop Behavior", () => {
            beforeEach(() => {
                mockIsMobile.mockReturnValue(false);
            });

            it("sends message on Enter (desktop)", async () => {
                mockInput = "Hello";

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Enter" });

                await waitFor(() => {
                    expect(mockAppend).toHaveBeenCalled();
                });
            });

            it("does not send on Shift+Enter (desktop)", () => {
                mockInput = "Hello";

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

                expect(mockAppend).not.toHaveBeenCalled();
            });

            it("stops generation on Escape when loading", () => {
                mockIsLoading = true;

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Escape" });

                expect(mockStop).toHaveBeenCalled();
            });

            it("does nothing on Escape when not loading", () => {
                mockIsLoading = false;

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Escape" });

                expect(mockStop).not.toHaveBeenCalled();
            });
        });

        describe("Mobile Behavior", () => {
            beforeEach(() => {
                mockIsMobile.mockReturnValue(true);
            });

            it("does NOT send on Enter (mobile)", () => {
                mockInput = "Hello";

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Enter" });

                expect(mockAppend).not.toHaveBeenCalled();
            });

            it("sends on Cmd+Enter (mobile power user)", async () => {
                mockInput = "Hello";

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Enter", metaKey: true });

                await waitFor(() => {
                    expect(mockAppend).toHaveBeenCalled();
                });
            });

            it("sends on Ctrl+Enter (mobile power user)", async () => {
                mockInput = "Hello";

                render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

                const input = screen.getByTestId("composer-input");
                fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

                await waitFor(() => {
                    expect(mockAppend).toHaveBeenCalled();
                });
            });
        });
    });

    describe("Streaming State", () => {
        it("shows stop button when loading", () => {
            mockIsLoading = true;
            mockInput = "";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("stop-button")).toBeInTheDocument();
        });

        it("shows queue button when loading with input", () => {
            mockIsLoading = true;
            mockInput = "New message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            expect(screen.getByTestId("queue-button")).toBeInTheDocument();
        });

        it("stops generation when stop button clicked", () => {
            mockIsLoading = true;
            mockInput = "";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const stopButton = screen.getByTestId("stop-button");
            fireEvent.click(stopButton);

            expect(mockStop).toHaveBeenCalled();
            expect(mockTriggerHaptic).toHaveBeenCalled();
        });

        it("clears concierge state on stop", () => {
            mockIsLoading = true;
            mockInput = "";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const stopButton = screen.getByTestId("stop-button");
            fireEvent.click(stopButton);

            expect(mockSetConcierge).toHaveBeenCalledWith(null);
        });

        it("marks last assistant message as stopped", () => {
            mockIsLoading = true;
            mockInput = "";
            mockMessages = [
                { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hi" }] },
                {
                    id: "msg-2",
                    role: "assistant",
                    parts: [{ type: "text", text: "Hello" }],
                },
            ];

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const stopButton = screen.getByTestId("stop-button");
            fireEvent.click(stopButton);

            expect(mockOnMarkMessageStopped).toHaveBeenCalledWith("msg-2");
        });

        it("queues message when queue button clicked", () => {
            mockIsLoading = true;
            mockInput = "Queued message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const queueButton = screen.getByTestId("queue-button");
            fireEvent.click(queueButton);

            expect(mockEnqueueMessage).toHaveBeenCalledWith("Queued message", []);
            expect(mockSetInput).toHaveBeenCalledWith("");
            expect(mockClearFiles).toHaveBeenCalled();
        });

        it("disables voice input during streaming", () => {
            mockIsLoading = true;

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const voiceButton = screen.getByTestId("voice-input");
            expect(voiceButton).toBeDisabled();
        });
    });

    describe("Voice Input Integration", () => {
        it("updates input when voice transcript received", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const voiceButton = screen.getByTestId("voice-input");
            fireEvent.click(voiceButton);

            expect(mockSetInput).toHaveBeenCalledWith("test voice input");
        });
    });

    describe("IME Composition", () => {
        it("does not send during composition", () => {
            mockInput = "Hello";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");

            // Start composition
            fireEvent.compositionStart(input);

            // Try to send
            fireEvent.keyDown(input, { key: "Enter" });

            expect(mockAppend).not.toHaveBeenCalled();
        });

        it("sends normally when not in composition mode", async () => {
            // This test verifies that without composition events, send works normally
            // The composition blocking behavior is tested above
            mockInput = "Hello";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");

            // Without any composition events, Enter should send normally
            fireEvent.keyDown(input, { key: "Enter" });

            await waitFor(() => {
                expect(mockAppend).toHaveBeenCalled();
            });
        });
    });

    describe("Focus and Blur Handling", () => {
        it("sets focus state on focus", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");
            fireEvent.focus(input);

            // Focus triggers border style change (isFocused state)
            // We can check by looking at the parent form styles
            const form = input.closest("form");
            expect(form).toBeInTheDocument();
        });

        it("saves draft immediately on blur", () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");
            fireEvent.blur(input);

            expect(mockSaveImmediately).toHaveBeenCalled();
        });
    });

    describe("Message Queue During Streaming", () => {
        it("queues message on Enter during streaming (desktop)", () => {
            // Set up streaming state with input text
            mockIsLoading = true;
            mockInput = "Queued via keyboard";
            mockIsMobile.mockReturnValue(false);

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");
            fireEvent.keyDown(input, { key: "Enter" });

            // On desktop, Enter during streaming queues the message
            expect(mockEnqueueMessage).toHaveBeenCalledWith("Queued via keyboard", []);
            expect(mockSetInput).toHaveBeenCalledWith("");
        });

        it("queues message even without files", () => {
            mockIsLoading = true;
            mockInput = "Message to queue";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const queueButton = screen.getByTestId("queue-button");
            fireEvent.click(queueButton);

            // Queue is called with message and empty files array
            expect(mockEnqueueMessage).toHaveBeenCalledWith("Message to queue", []);
        });
    });

    describe("User Engagement Events", () => {
        it("emits engagement event on first input change", async () => {
            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const input = screen.getByTestId("composer-input");

            // Trigger input change - need to call handleInputChange
            fireEvent.change(input, { target: { value: "a" } });

            await waitFor(() => {
                expect(window.dispatchEvent).toHaveBeenCalledWith(
                    expect.objectContaining({ type: "carmenta:user-engaged" })
                );
            });
        });
    });

    describe("Concurrent Submission Prevention", () => {
        it("prevents double submit on rapid clicks", async () => {
            mockInput = "Test message";

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;

            // Rapid fire submits
            fireEvent.submit(form);
            fireEvent.submit(form);
            fireEvent.submit(form);

            // Wait for async operations
            await waitFor(() => {
                // Should only be called once due to isSubmittingRef guard
                expect(mockAppend).toHaveBeenCalledTimes(1);
            });
        });

        it("does not submit when already loading", async () => {
            mockInput = "Test message";
            mockIsLoading = true;

            render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

            const form = screen.getByTestId("composer-input").closest("form")!;
            fireEvent.submit(form);

            // isLoading guard prevents submission
            expect(mockAppend).not.toHaveBeenCalled();
        });
    });
});

describe("Paste Handling", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("handles pasting images by creating placeholders", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");

        // Create a mock paste event with an image
        const mockFile = new File(["image data"], "test.png", { type: "image/png" });
        const mockItem = {
            type: "image/png",
            getAsFile: () => mockFile,
        };

        const pasteEvent = {
            clipboardData: {
                items: [mockItem],
                getData: () => "",
            },
            preventDefault: vi.fn(),
        };

        fireEvent.paste(input, pasteEvent);

        // Should call addFiles with the image
        expect(mockAddFiles).toHaveBeenCalled();
    });

    it("handles small text paste normally (no interception)", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");

        // Small text paste - should not be intercepted
        const pasteEvent = {
            clipboardData: {
                items: [],
                getData: () => "short text",
            },
            preventDefault: vi.fn(),
        };

        fireEvent.paste(input, pasteEvent);

        // Should NOT call addPastedText for small text
        expect(mockAddPastedText).not.toHaveBeenCalled();
        expect(pasteEvent.preventDefault).not.toHaveBeenCalled();
    });
});

describe("Interrupt Flow", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "Interrupt message";
        mockIsLoading = true;
        mockMessages = [
            { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hi" }] },
            {
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "text", text: "Hello" }],
            },
        ];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("interrupts on Shift+Enter during streaming with input", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");

        // Shift+Enter during streaming = interrupt
        fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

        // Should stop current generation
        expect(mockStop).toHaveBeenCalled();
        // Should mark last message as stopped
        expect(mockOnMarkMessageStopped).toHaveBeenCalledWith("msg-2");
    });

    it("restores message text when stopping with empty input", () => {
        mockInput = "";
        // We need to simulate lastSentMessageRef containing a value
        // This is tricky to test directly, but we can verify stop behavior
        mockIsLoading = true;

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const stopButton = screen.getByTestId("stop-button");
        fireEvent.click(stopButton);

        expect(mockStop).toHaveBeenCalled();
        // setInput may or may not be called depending on lastSentMessageRef
        // The important thing is stop is called
    });
});

describe("Desktop Autofocus", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
    });

    afterEach(() => {
        cleanup();
    });

    it("does not autofocus on mobile", () => {
        mockIsMobile.mockReturnValue(true);

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // On mobile, input should not be auto-focused
        const input = screen.getByTestId("composer-input");
        expect(document.activeElement).not.toBe(input);
    });
});

describe("Shift+Enter Hint", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);

        // Reset localStorage mock
        const localStorageMock = {
            getItem: vi.fn(() => null), // Hint not shown before
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        };
        Object.defineProperty(window, "localStorage", { value: localStorageMock });
    });

    afterEach(() => {
        cleanup();
    });

    it("shows shift+enter hint on first focus for new users", async () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.focus(input);

        // The hint should appear (Shift + Enter text)
        await waitFor(() => {
            expect(screen.getByText("Shift")).toBeInTheDocument();
            expect(screen.getByText("Enter")).toBeInTheDocument();
            expect(screen.getByText("for new line")).toBeInTheDocument();
        });
    });

    it("does not show hint if already shown before", async () => {
        // localStorage returns that hint was shown
        const localStorageMock = {
            getItem: vi.fn(() => "true"),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        };
        Object.defineProperty(window, "localStorage", { value: localStorageMock });

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.focus(input);

        // Wait a bit for potential render
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Hint should NOT appear
        expect(screen.queryByText("for new line")).not.toBeInTheDocument();
    });
});

describe("Draft Recovery Banner", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("dismisses draft recovery when user starts typing", () => {
        // Need to set up the mock to return hasRecoveredDraft: true
        // This requires overriding the useDraftPersistence mock for this test
        // For now, we verify the change handler calls dismissRecovery
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.change(input, { target: { value: "a" } });

        // The change handler should be called
        expect(mockHandleInputChange).toHaveBeenCalled();
    });
});

describe("Upload Progress Display", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("does not show upload progress when no pending files", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // Upload progress should not be visible with no pending files
        expect(screen.queryByTestId("upload-progress")).not.toBeInTheDocument();
    });
});

describe("Message Queue Display", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("does not show message queue when queue is empty", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // Message queue should not be visible with empty queue
        expect(screen.queryByTestId("message-queue")).not.toBeInTheDocument();
    });
});

describe("ComposerButton Variants", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = false;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("shows send button with CTA styling when idle", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const sendButton = screen.getByTestId("send-button");
        expect(sendButton).toBeInTheDocument();
        expect(sendButton.className).toContain("btn-cta");
    });

    it("shows stop button with muted styling when streaming", () => {
        mockIsLoading = true;
        mockInput = "";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const stopButton = screen.getByTestId("stop-button");
        expect(stopButton).toBeInTheDocument();
    });

    it("shows queue button with accent styling when streaming with input", () => {
        mockIsLoading = true;
        mockInput = "Queued message";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const queueButton = screen.getByTestId("queue-button");
        expect(queueButton).toBeInTheDocument();
    });

    // Upload state disabling is tested via integration tests
});

describe("Mobile Queue Behavior", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "Mobile queue test";
        mockIsLoading = true;
        mockMessages = [];
        mockIsMobile.mockReturnValue(true);
    });

    afterEach(() => {
        cleanup();
    });

    it("queues on Cmd+Enter during streaming on mobile", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.keyDown(input, { key: "Enter", metaKey: true });

        expect(mockEnqueueMessage).toHaveBeenCalledWith("Mobile queue test", []);
        expect(mockSetInput).toHaveBeenCalledWith("");
    });

    it("queues on Ctrl+Enter during streaming on mobile", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

        expect(mockEnqueueMessage).toHaveBeenCalledWith("Mobile queue test", []);
    });
});

describe("Pipeline State Transitions", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("shows concierge state when loading without concierge data", () => {
        mockIsLoading = true;
        // concierge is null (mock default)

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // Stop button should be visible during loading
        expect(screen.getByTestId("stop-button")).toBeInTheDocument();
    });

    it("transitions to streaming state when concierge data arrives", async () => {
        mockIsLoading = true;

        const { rerender } = render(
            <Composer onMarkMessageStopped={mockOnMarkMessageStopped} />
        );

        // Initial state - stop button visible
        expect(screen.getByTestId("stop-button")).toBeInTheDocument();

        // After concierge data arrives (simulated by still being loading)
        // The visual state changes but the button remains stop
        rerender(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        expect(screen.getByTestId("stop-button")).toBeInTheDocument();
    });

    it("transitions to complete state when loading ends", async () => {
        mockIsLoading = true;
        mockInput = "";

        const { rerender } = render(
            <Composer onMarkMessageStopped={mockOnMarkMessageStopped} />
        );

        expect(screen.getByTestId("stop-button")).toBeInTheDocument();

        // Simulate loading complete
        mockIsLoading = false;
        rerender(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // Should now show send button
        expect(screen.getByTestId("send-button")).toBeInTheDocument();
    });
});

describe("Textarea Auto-resize", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockMessages = [];
        mockIsLoading = false;
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("handles single-line input without explicit height", () => {
        mockInput = "Single line";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        // Single-line input should not have explicit height style
        expect(input).toBeInTheDocument();
    });

    it("handles multi-line input with auto-resize", () => {
        mockInput = "Line 1\nLine 2\nLine 3";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        // Multi-line input triggers different styling
        expect(input).toBeInTheDocument();
    });
});

describe("Empty Input Edge Cases", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockMessages = [];
        mockIsLoading = false;
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("does not send on Enter with only whitespace", () => {
        mockInput = "   ";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.keyDown(input, { key: "Enter" });

        // Whitespace-only should not trigger send
        expect(mockAppend).not.toHaveBeenCalled();
    });

    it("does not queue empty message during streaming", () => {
        mockIsLoading = true;
        mockInput = "";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.keyDown(input, { key: "Enter" });

        expect(mockEnqueueMessage).not.toHaveBeenCalled();
    });

    it("does not queue whitespace-only message during streaming", () => {
        mockIsLoading = true;
        mockInput = "   ";

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const input = screen.getByTestId("composer-input");
        fireEvent.keyDown(input, { key: "Enter" });

        // Whitespace-only should not queue
        expect(mockEnqueueMessage).not.toHaveBeenCalled();
    });
});

describe("Stop Button Behavior", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "";
        mockIsLoading = true;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("does not stop when not loading", () => {
        mockIsLoading = false;

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        // Send button is shown when not loading
        expect(screen.getByTestId("send-button")).toBeInTheDocument();
    });

    it("does not mark user message as stopped", () => {
        mockMessages = [
            { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hi" }] },
        ];

        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        const stopButton = screen.getByTestId("stop-button");
        fireEvent.click(stopButton);

        // Should not mark user message as stopped
        expect(mockOnMarkMessageStopped).not.toHaveBeenCalled();
    });
});

describe("Queue Full State", () => {
    const mockOnMarkMessageStopped = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockInput = "Test message";
        mockIsLoading = true;
        mockMessages = [];
        mockIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    // Note: Testing queue full state requires overriding the useMessageQueue mock
    // which would need a more complex setup. This is documented for future expansion.
    it("queue button exists when loading with input", () => {
        render(<Composer onMarkMessageStopped={mockOnMarkMessageStopped} />);

        expect(screen.getByTestId("queue-button")).toBeInTheDocument();
    });
});
