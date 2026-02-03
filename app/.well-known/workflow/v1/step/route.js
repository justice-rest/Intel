// biome-ignore-all lint: generated file
/* eslint-disable */

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/workflow/dist/internal/builtins.js
import { registerStepFunction } from "workflow/internal/private";
async function __builtin_response_array_buffer(res) {
  return res.arrayBuffer();
}
__name(__builtin_response_array_buffer, "__builtin_response_array_buffer");
async function __builtin_response_json(res) {
  return res.json();
}
__name(__builtin_response_json, "__builtin_response_json");
async function __builtin_response_text(res) {
  return res.text();
}
__name(__builtin_response_text, "__builtin_response_text");
registerStepFunction("__builtin_response_array_buffer", __builtin_response_array_buffer);
registerStepFunction("__builtin_response_json", __builtin_response_json);
registerStepFunction("__builtin_response_text", __builtin_response_text);

// lib/workflows/crm-sync.workflow.ts
import { z } from "zod";
var CRMSyncParamsSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  provider: z.enum([
    "bloomerang",
    "virtuous",
    "neoncrm",
    "donorperfect"
  ]),
  apiKey: z.string().min(1, "apiKey is required"),
  syncLogId: z.string().uuid("syncLogId must be a valid UUID")
});
async function syncCRMData(params) {
  throw new Error("You attempted to execute workflow syncCRMData function directly. To start a workflow, use start(syncCRMData) from workflow/api");
}
__name(syncCRMData, "syncCRMData");
syncCRMData.workflowId = "workflow//lib/workflows/crm-sync.workflow.ts//syncCRMData";

// lib/workflows/memory-extraction.workflow.ts
import { z as z2 } from "zod";
var MemoryExtractionParamsSchema = z2.object({
  userId: z2.string().uuid("userId must be a valid UUID"),
  chatId: z2.string().uuid("chatId must be a valid UUID"),
  userMessage: z2.string().min(1, "userMessage is required"),
  assistantResponse: z2.string().min(1, "assistantResponse is required"),
  messageId: z2.string().optional(),
  apiKey: z2.string().optional()
});
async function extractMemoriesWorkflow(params) {
  throw new Error("You attempted to execute workflow extractMemoriesWorkflow function directly. To start a workflow, use start(extractMemoriesWorkflow) from workflow/api");
}
__name(extractMemoriesWorkflow, "extractMemoriesWorkflow");
extractMemoriesWorkflow.workflowId = "workflow//lib/workflows/memory-extraction.workflow.ts//extractMemoriesWorkflow";

// node_modules/workflow/dist/stdlib.js
import { registerStepFunction as registerStepFunction2 } from "workflow/internal/private";
async function fetch(...args) {
  return globalThis.fetch(...args);
}
__name(fetch, "fetch");
registerStepFunction2("step//node_modules/workflow/dist/stdlib.js//fetch", fetch);

// virtual-entry.js
import { stepEntrypoint } from "workflow/runtime";
export {
  stepEntrypoint as POST
};
