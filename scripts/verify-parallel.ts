import searchWeb from "../agent/tools/search_web.ts";

async function main() {
  if (!process.env.PARALLEL_API_KEY) {
    throw new Error("No Parallel Search authentication is available.");
  }

  const result = await searchWeb.execute(
    {
      objective:
        "Find locally distinctive, calm public experiences in Fukuoka that combine movement with an unfamiliar setting. Avoid generic attractions and chains.",
      searchQueries: [
        "Fukuoka quiet local cycling island experience",
        "Fukuoka unusual low crowd outdoor activity",
      ],
      mode: "turbo",
    },
    {
      abortSignal: new AbortController().signal,
    } as Parameters<typeof searchWeb.execute>[1],
  );

  if (result.results.length === 0) {
    throw new Error("Parallel Search connected, but returned no results for the verification query.");
  }

  console.log(`Parallel Search connected (${result.results.length} results).`);
}

void main();
