"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// worker/workflows/index.ts
var index_exports = {};
__export(index_exports, {
  agentJobWorkflow: () => agentJobWorkflow,
  backgroundResponseWorkflow: () => backgroundResponseWorkflow,
  importLibrarianJobWorkflow: () => importLibrarianJobWorkflow
});
module.exports = __toCommonJS(index_exports);

// worker/workflows/agent-job.ts
var import_workflow = require("@temporalio/workflow");
function extractRootCauseMessage(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  let current = error;
  let deepestMessage = error.message;
  while (current?.cause instanceof Error) {
    current = current.cause;
    if (current.message) {
      deepestMessage = current.message;
    }
  }
  if (error instanceof import_workflow.ApplicationFailure && error.details && error.details.length > 0) {
    const details = error.details[0];
    if (typeof details === "string") {
      return details;
    }
  }
  return deepestMessage;
}
function extractRootCauseStack(error) {
  if (!(error instanceof Error)) {
    return void 0;
  }
  let current = error;
  let deepestStack = error.stack;
  while (current?.cause instanceof Error) {
    current = current.cause;
    if (current.stack) {
      deepestStack = current.stack;
    }
  }
  return deepestStack;
}
var {
  loadFullJobContext,
  createJobRun,
  generateJobStreamId,
  executeStreamingEmployee,
  updateJobRunStreamId,
  finalizeJobRun,
  clearJobRunStreamId
} = (0, import_workflow.proxyActivities)({
  startToCloseTimeout: "10 minutes",
  // Longer timeout for tool-using agents
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});
async function agentJobWorkflow(input) {
  const { jobId } = input;
  const context = await loadFullJobContext(jobId);
  const runId = await createJobRun(jobId);
  const streamId = await generateJobStreamId(jobId);
  await updateJobRunStreamId(runId, streamId);
  try {
    const result = await executeStreamingEmployee(context, streamId);
    await finalizeJobRun(runId, jobId, context.userId, result);
    return {
      success: result.success,
      summary: result.summary,
      runId
    };
  } catch (error) {
    const errorMessage = extractRootCauseMessage(error);
    const errorStack = extractRootCauseStack(error);
    const errorCode = error?.code ?? error?.cause?.code ?? "WORKFLOW_ACTIVITY_FAILED";
    const failedResult = {
      success: false,
      summary: `Failed: ${errorMessage}`,
      toolCallsExecuted: 0,
      notifications: [],
      updatedMemory: context.memory,
      // Observability fields for debugging
      errorDetails: {
        message: errorMessage,
        code: errorCode,
        stack: errorStack,
        context: {
          jobId,
          runId,
          failedAt: (/* @__PURE__ */ new Date()).toISOString(),
          failurePoint: "workflow_catch",
          // Include original wrapper message for debugging
          temporalMessage: error instanceof Error ? error.message : void 0
        }
      }
    };
    try {
      await finalizeJobRun(runId, jobId, context.userId, failedResult);
    } catch (finalizationError) {
      await clearJobRunStreamId(runId).catch(() => {
      });
    }
    throw error;
  }
}

// worker/workflows/background-response.ts
var import_workflow2 = require("@temporalio/workflow");
function extractRootCauseMessage2(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  let current = error;
  let deepestMessage = error.message;
  while (current?.cause instanceof Error) {
    current = current.cause;
    if (current.message) {
      deepestMessage = current.message;
    }
  }
  if (error instanceof import_workflow2.ApplicationFailure && error.details && error.details.length > 0) {
    const details = error.details[0];
    if (typeof details === "string") {
      return details;
    }
  }
  return deepestMessage;
}
var {
  loadConnectionContext,
  generateBackgroundResponse,
  saveBackgroundResponse,
  updateConnectionStatus
} = (0, import_workflow2.proxyActivities)({
  startToCloseTimeout: "10 minutes",
  // Generous for deep research
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});
async function backgroundResponseWorkflow(input) {
  const { connectionId, streamId } = input;
  try {
    const context = await loadConnectionContext(input);
    const result = await generateBackgroundResponse(input, context);
    await saveBackgroundResponse(connectionId, streamId, result.parts);
    await updateConnectionStatus(connectionId, "completed");
    return {
      success: true,
      partCount: result.parts.length
    };
  } catch (error) {
    const rootCauseMessage = extractRootCauseMessage2(error);
    try {
      await updateConnectionStatus(connectionId, "failed");
    } catch {
    }
    throw import_workflow2.ApplicationFailure.nonRetryable(
      rootCauseMessage,
      "BackgroundResponseFailed"
    );
  }
}

// worker/workflows/import-librarian-job.ts
var import_workflow3 = require("@temporalio/workflow");
var {
  loadImportLibrarianContext,
  processConversationBatch,
  updateJobProgress,
  finalizeImportLibrarianJob
} = (0, import_workflow3.proxyActivities)({
  startToCloseTimeout: "10 minutes",
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});
var BATCH_SIZE = 10;
async function importLibrarianJobWorkflow(input) {
  const { jobId } = input;
  let totalProcessed = 0;
  let totalExtracted = 0;
  const allErrors = [];
  try {
    const context = await loadImportLibrarianContext(input);
    if (context.connectionIds.length === 0) {
      await finalizeImportLibrarianJob(jobId, true);
      return {
        success: true,
        totalProcessed: 0,
        totalExtracted: 0,
        errors: []
      };
    }
    for (let i = 0; i < context.connectionIds.length; i += BATCH_SIZE) {
      const batch = context.connectionIds.slice(i, i + BATCH_SIZE);
      const result = await processConversationBatch(context, batch);
      totalProcessed += result.processedCount;
      totalExtracted += result.extractedCount;
      allErrors.push(...result.errors);
      await updateJobProgress(jobId, totalProcessed, totalExtracted);
    }
    await finalizeImportLibrarianJob(jobId, true);
    return {
      success: true,
      totalProcessed,
      totalExtracted,
      errors: allErrors
    };
  } catch (error) {
    const errorMessage = extractRootCauseMessage3(error);
    await finalizeImportLibrarianJob(jobId, false, errorMessage).catch(() => {
    });
    throw import_workflow3.ApplicationFailure.nonRetryable(errorMessage, "ImportLibrarianJobFailed");
  }
}
function extractRootCauseMessage3(error) {
  if (!(error instanceof Error)) return String(error);
  let current = error;
  let deepestMessage = error.message;
  while (current?.cause instanceof Error) {
    current = current.cause;
    if (current.message) {
      deepestMessage = current.message;
    }
  }
  return deepestMessage;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  agentJobWorkflow,
  backgroundResponseWorkflow,
  importLibrarianJobWorkflow
});
//# sourceMappingURL=workflows.cjs.map
