import { defineTool } from "eve/tools";

import { assertSidequestIntegrity, sidequestSchema } from "../lib/sidequest-schema";

export default defineTool({
  description:
    "Submit the one finished Sidequest after creative selection and factual verification. Call exactly once, only when the experience is ready for the user.",
  inputSchema: sidequestSchema,
  outputSchema: sidequestSchema,
  execute(sidequest) {
    assertSidequestIntegrity(sidequest);
    return sidequest;
  },
});
