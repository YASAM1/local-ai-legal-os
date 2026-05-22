import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { getChatModel } from "@/lib/model";
import { fileTools } from "@/lib/tools/file-tools";
import { ragTools } from "@/lib/tools/rag-tools";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { ensureWorkspace } from "@/lib/workspace";

export const maxDuration = 300;

export async function POST(req: Request) {
  await ensureWorkspace();
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getChatModel(),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools: {
      ...fileTools,
      ...ragTools,
    },
    stopWhen: stepCountIs(20),
  });

  return result.toUIMessageStreamResponse();
}
