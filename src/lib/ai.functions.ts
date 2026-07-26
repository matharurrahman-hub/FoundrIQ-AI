import { createServerFn } from "@tanstack/react-start";
import type { ChatTurn, StartupBlueprint, StartupBlueprintInput } from "./ai.types";

export type { ChatTurn, StartupBlueprint, StartupBlueprintInput } from "./ai.types";

export const generateStartup = createServerFn({ method: "POST" })
  .inputValidator((data: StartupBlueprintInput) => data)
  .handler(async ({ data }): Promise<StartupBlueprint> => {
    const { generateBlueprint } = await import("./gemini.server");
    return generateBlueprint(data);
  });

export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: { history: ChatTurn[]; message: string; context?: string | null }) => data)
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { chat } = await import("./gemini.server");
    return { text: await chat(data) };
  });
