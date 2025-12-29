/**
 * Inngest API Route Handler
 *
 * Serves Inngest functions for durable execution. This endpoint is called
 * by Inngest to execute functions in response to events.
 */

import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { backgroundResponse } from "@/lib/inngest/functions/background-response";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [backgroundResponse],
});
