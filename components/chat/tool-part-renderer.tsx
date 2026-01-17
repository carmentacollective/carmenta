"use client";

/**
 * ToolPartRenderer - Renders tool outputs in chat messages
 *
 * Shared component used by both HoloThread and SidecarThread for consistent
 * tool output rendering. Routes tool parts to appropriate UI components.
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/client-logger";
import { ToolRenderer } from "@/components/tools/shared";
import {
    WebSearchResults,
    CompareTable,
    DeepResearchResult,
    FetchPageResult,
} from "@/components/tools/research";
import {
    ClickUpToolResult,
    CoinMarketCapToolResult,
    CreateImageToolResult,
    DropboxToolResult,
    FirefliesToolResult,
    GiphyToolResult,
    GoogleCalendarContactsToolResult,
    GoogleWorkspaceFilesToolResult,
    ImgflipToolResult,
    LimitlessToolResult,
    LinkedInToolResult,
    NotionToolResult,
    QuoToolResult,
    SlackToolResult,
    TwitterToolResult,
} from "@/components/tools/integrations";
import { Plan } from "@/components/tool-ui/plan";
import type { PlanTodo } from "@/components/tool-ui/plan/schema";
import { renderCodeTool } from "@/components/tools";
import {
    SuggestQuestionsResult,
    ShowReferencesResult,
    AskUserInputResult,
    AcknowledgeResult,
} from "@/components/tools/post-response";
import {
    PlanResult,
    LinkPreviewResult,
    OptionListResult,
    POIMapResult,
    CalculateResult,
} from "@/components/tools/interactive";
import type {
    SuggestQuestionsOutput,
    ShowReferencesOutput,
    AskUserInputOutput,
    AcknowledgeOutput,
} from "@/lib/tools/post-response";
import { type ToolPart, getToolStatus, getToolError } from "./message-parts";
import { McpToolResult } from "@/components/tools/mcp";

interface ToolPartRendererProps {
    part: ToolPart;
}

/**
 * Render a single tool part with the appropriate UI component
 */
export function ToolPartRenderer({ part }: ToolPartRendererProps) {
    // Defensive check - part should never be undefined given our type guard,
    // but the AI SDK's stream resume can produce unexpected data structures
    if (!part || typeof part !== "object" || !part.type || !part.state) {
        logger.warn({ part }, "ToolPartRenderer received invalid part");
        return null;
    }

    const toolName = part.type.replace("tool-", "");
    const status = getToolStatus(part.state);
    const input = part.input as Record<string, unknown>;
    const output = part.output as Record<string, unknown> | undefined;

    // Try code tools registry first - returns beautiful renderers for Claude Code tools
    const codeToolResult = renderCodeTool({
        toolCallId: part.toolCallId,
        toolName,
        status,
        input,
        output,
        error: getToolError(part, output),
    });
    if (codeToolResult) {
        return codeToolResult;
    }

    switch (toolName) {
        case "webSearch": {
            type SearchResult = {
                title: string;
                url: string;
                snippet: string;
                publishedDate?: string;
            };

            return (
                <WebSearchResults
                    toolCallId={part.toolCallId}
                    status={status}
                    query={(input?.query as string) ?? ""}
                    results={output?.results as SearchResult[] | undefined}
                    error={getToolError(part, output, "Search failed")}
                />
            );
        }

        case "compareOptions": {
            type CompareOption = { name: string; attributes: Record<string, string> };
            return (
                <CompareTable
                    toolCallId={part.toolCallId}
                    status={status}
                    title={(input?.title as string) ?? "Comparison"}
                    options={output?.options as CompareOption[] | undefined}
                    error={getToolError(part, output, "Comparison failed")}
                />
            );
        }

        case "fetchPage": {
            return (
                <FetchPageResult
                    toolCallId={part.toolCallId}
                    status={status}
                    url={(input?.url as string) ?? ""}
                    title={output?.title as string | undefined}
                    content={output?.content as string | undefined}
                    error={getToolError(part, output, "Failed to fetch")}
                />
            );
        }

        case "deepResearch": {
            // Don't render until input is available (streaming may have incomplete data)
            if (part.state === "input-streaming") {
                return null;
            }

            type Finding = {
                insight: string;
                sources: string[];
                confidence: "high" | "medium" | "low";
            };
            type Source = { url: string; title: string; relevance: string };

            return (
                <DeepResearchResult
                    toolCallId={part.toolCallId}
                    status={status}
                    objective={(input?.objective as string) ?? ""}
                    depth={input?.depth as "quick" | "standard" | "deep" | undefined}
                    summary={output?.summary as string | undefined}
                    findings={output?.findings as Finding[] | undefined}
                    sources={output?.sources as Source[] | undefined}
                    error={getToolError(part, output, "Research failed")}
                />
            );
        }

        case "getWeather": {
            const weatherOutput = output as
                | {
                      location?: string;
                      temperature?: number;
                      condition?: string;
                      humidity?: number;
                      windSpeed?: number;
                  }
                | undefined;
            const weatherError = getToolError(part, output, "Weather check failed");
            const hasWeatherData = status === "completed" && weatherOutput;

            return (
                <ToolRenderer
                    toolName="getWeather"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={weatherError}
                >
                    {hasWeatherData && (
                        <div className="text-sm">
                            <div className="text-lg font-medium">
                                {weatherOutput.temperature}°F {weatherOutput.condition}
                            </div>
                            <div className="text-muted-foreground">
                                {weatherOutput.location}
                            </div>
                            <div className="text-muted-foreground mt-2 text-xs">
                                Humidity: {weatherOutput.humidity}% · Wind:{" "}
                                {weatherOutput.windSpeed} mph
                            </div>
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        // Integration tools - keep alphabetical to minimize merge conflicts
        case "clickup":
            return (
                <ClickUpToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "ClickUp request failed")}
                />
            );

        case "coinmarketcap":
            return (
                <CoinMarketCapToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "CoinMarketCap request failed")}
                />
            );

        case "createImage":
            return (
                <CreateImageToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Image generation failed")}
                />
            );

        case "dropbox":
            return (
                <DropboxToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Dropbox request failed")}
                />
            );

        case "fireflies":
            return (
                <FirefliesToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Fireflies request failed")}
                />
            );

        case "giphy":
            return (
                <GiphyToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Giphy request failed")}
                />
            );

        case "imgflip":
            return (
                <ImgflipToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Imgflip request failed")}
                />
            );

        case "google-calendar-contacts":
            return (
                <GoogleCalendarContactsToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Google Calendar request failed")}
                />
            );

        case "google-workspace-files":
            return (
                <GoogleWorkspaceFilesToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(
                        part,
                        output,
                        "Google Workspace request failed"
                    )}
                />
            );

        case "limitless":
            return (
                <LimitlessToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Limitless request failed")}
                />
            );

        case "linkedin":
            return (
                <LinkedInToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "LinkedIn request failed")}
                />
            );

        case "notion":
            return (
                <NotionToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Notion request failed")}
                />
            );

        case "quo":
            return (
                <QuoToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Quo request failed")}
                />
            );

        case "slack":
            return (
                <SlackToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Slack request failed")}
                />
            );

        case "twitter":
            return (
                <TwitterToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Twitter request failed")}
                />
            );

        // Knowledge & Discovery tools - internal tools for context management
        case "searchKnowledge":
        case "updateDiscovery":
        case "completeDiscovery":
        case "skipDiscovery":
            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Knowledge operation failed")}
                />
            );

        // DCOS subagent tools - used by Carmenta orchestrator
        case "dcos":
        case "librarian":
        case "mcpConfig":
        case "smsUser":
            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "DCOS operation failed")}
                />
            );

        // Tool-UI Components - Rich interactive displays
        case "plan":
        case "taskPlan": {
            const planError = getToolError(part, output, "Plan creation failed");
            return (
                <PlanResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={planError}
                />
            );
        }

        case "linkPreview":
        case "previewLink": {
            const previewError = getToolError(part, output, "Link preview failed");
            return (
                <LinkPreviewResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={previewError}
                />
            );
        }

        case "optionList":
        case "selectOption":
        case "presentOptions": {
            const optionsError = getToolError(part, output, "Options display failed");
            return (
                <OptionListResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={optionsError}
                />
            );
        }

        case "poiMap":
        case "showLocations":
        case "mapLocations": {
            const mapError = getToolError(part, output, "Map display failed");
            return (
                <POIMapResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={mapError}
                />
            );
        }

        case "calculate": {
            const calcError = getToolError(part, output, "Calculation failed");
            return (
                <CalculateResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={calcError}
                />
            );
        }

        // Claude Code tools - handled by registry (components/tools/registry.tsx)
        // Read, Write, Edit, Bash, Glob, Grep now use beautiful dedicated renderers

        case "Task": {
            // Sub-agent task - show agent type and description
            const agentType = input.subagent_type as string | undefined;
            const description = input.description as string | undefined;
            const taskResult = output as string | undefined;
            const taskError = getToolError(part, output, "Sub-task failed");

            return (
                <ToolRenderer
                    toolName="Task"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={taskError}
                >
                    {(agentType || description || taskResult) && (
                        <div className="space-y-2">
                            {agentType && (
                                <div className="text-xs font-medium text-cyan-400">
                                    Agent: {agentType}
                                </div>
                            )}
                            {description && (
                                <div className="text-muted-foreground text-xs">
                                    {description}
                                </div>
                            )}
                            {status === "completed" && taskResult && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {typeof taskResult === "string"
                                        ? taskResult.slice(0, 2000)
                                        : JSON.stringify(taskResult, null, 2).slice(
                                              0,
                                              2000
                                          )}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "TodoWrite": {
            // Task list management - use existing Plan component
            const todosInput = input.todos as
                | Array<{
                      content?: string;
                      status: "pending" | "in_progress" | "completed";
                      activeForm?: string;
                  }>
                | undefined;

            const todos: PlanTodo[] = (todosInput ?? []).map((todo, idx) => ({
                id: `todo-${idx}`,
                label: todo.content || todo.activeForm || "Task",
                status: todo.status,
            }));

            return (
                <ToolRenderer
                    toolName="TodoWrite"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Failed to update tasks")}
                >
                    {todos.length > 0 && (
                        <Plan
                            id={`todo-${part.toolCallId}`}
                            title="Task Progress"
                            todos={todos}
                            showProgress={true}
                            maxVisibleTodos={6}
                        />
                    )}
                </ToolRenderer>
            );
        }

        case "LSP": {
            // Code intelligence - show operation and results
            const operation = input.operation as string | undefined;
            const lspError = getToolError(part, output, "Code analysis failed");
            const hasOutput = status === "completed" && output !== undefined;

            return (
                <ToolRenderer
                    toolName="LSP"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={lspError}
                >
                    {(operation || hasOutput) && (
                        <div className="space-y-2">
                            {operation && (
                                <div className="text-muted-foreground text-xs">
                                    Operation: {operation}
                                </div>
                            )}
                            {hasOutput && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {JSON.stringify(output, null, 2).slice(0, 2000)}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "NotebookEdit": {
            // Jupyter notebook editing
            const notebookPath = input.notebook_path as string | undefined;
            const editMode = input.edit_mode as string | undefined;
            const notebookError = getToolError(part, output, "Failed to edit notebook");

            return (
                <ToolRenderer
                    toolName="NotebookEdit"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={notebookError}
                >
                    {status === "completed" && (
                        <div className="text-muted-foreground space-y-1 text-xs">
                            {notebookPath && (
                                <div className="font-mono">{notebookPath}</div>
                            )}
                            {editMode && <div>Mode: {editMode}</div>}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "WebFetch": {
            // Web page fetch - similar to fetchPage
            const fetchUrl = input.url as string | undefined;
            const fetchContent = output as
                | { content?: string; title?: string }
                | string
                | undefined;
            const fetchError = getToolError(part, output, "Failed to fetch page");

            const title =
                typeof fetchContent === "object" ? fetchContent?.title : undefined;
            const content =
                typeof fetchContent === "object" ? fetchContent?.content : fetchContent;

            return (
                <ToolRenderer
                    toolName="WebFetch"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={fetchError}
                >
                    {status === "completed" && (
                        <div className="space-y-2">
                            {fetchUrl && (
                                <div className="text-muted-foreground truncate font-mono text-xs">
                                    {fetchUrl}
                                </div>
                            )}
                            {title && (
                                <div className="text-sm font-medium">{title}</div>
                            )}
                            {content && (
                                <pre className="max-h-32 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {content.slice(0, 1000)}
                                    {content.length > 1000 && "..."}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "WebSearch": {
            // Web search - Claude Code variant (capital W)
            // Uses different output format than lowercase webSearch
            const searchQuery = input.query as string | undefined;
            const searchResults = output as
                | string
                | Array<{ title?: string; url?: string }>
                | undefined;
            const webSearchError = getToolError(part, output, "Search failed");

            return (
                <ToolRenderer
                    toolName="WebSearch"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={webSearchError}
                >
                    {status === "completed" && (
                        <div className="space-y-2">
                            {searchQuery && (
                                <div className="text-muted-foreground text-xs">
                                    Query: {searchQuery}
                                </div>
                            )}
                            {searchResults && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {typeof searchResults === "string"
                                        ? searchResults.slice(0, 2000)
                                        : JSON.stringify(searchResults, null, 2).slice(
                                              0,
                                              2000
                                          )}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        // Post-response enhancement tools
        case "suggestQuestions": {
            return (
                <SuggestQuestionsResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as SuggestQuestionsOutput | undefined}
                    error={getToolError(part, output, "Couldn't generate suggestions")}
                />
            );
        }

        case "showReferences": {
            return (
                <ShowReferencesResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as ShowReferencesOutput | undefined}
                    error={getToolError(part, output, "Couldn't load sources")}
                />
            );
        }

        case "askUserInput": {
            return (
                <AskUserInputResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as AskUserInputOutput | undefined}
                    error={getToolError(part, output, "Couldn't prepare question")}
                />
            );
        }

        case "acknowledge": {
            return (
                <AcknowledgeResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as AcknowledgeOutput | undefined}
                    error={getToolError(part, output, "Couldn't express appreciation")}
                />
            );
        }

        // Additional integration tools without dedicated components
        case "spotify":
        case "pushNotification":
            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, `${toolName} operation failed`)}
                />
            );

        // imageArtist is an alias for createImage
        case "imageArtist":
            return (
                <CreateImageToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Image generation failed")}
                />
            );

        default: {
            // MCP tools from Claude Code use mcp_<server> or mcp-<server> naming
            // Handle them with the specialized McpToolResult component
            if (toolName.startsWith("mcp_") || toolName.startsWith("mcp-")) {
                return (
                    <McpToolResult
                        toolCallId={part.toolCallId}
                        toolName={toolName}
                        status={status}
                        input={input}
                        output={output}
                        error={getToolError(part, output, "Operation failed")}
                    />
                );
            }

            // Unknown tool - this is a bug. Every tool needs an explicit renderer.
            // Log error and report to Sentry so we catch missing renderers in production.
            logger.error(
                { toolName, toolCallId: part.toolCallId },
                `Missing tool renderer for "${toolName}". Add a case to ToolPartRenderer.`
            );
            Sentry.captureException(
                new Error(`Missing tool renderer for "${toolName}"`),
                {
                    tags: { component: "ToolPartRenderer", toolName },
                    extra: { toolCallId: part.toolCallId, input },
                }
            );

            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={`Tool "${toolName}" has no UI renderer. This is a bug.`}
                />
            );
        }
    }
}
