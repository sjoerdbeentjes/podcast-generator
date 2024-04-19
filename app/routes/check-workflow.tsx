import { LoaderFunctionArgs, json } from "@remix-run/deno";
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function loader({ request }: LoaderFunctionArgs) {
  const run_id = new URL(request.url).searchParams.get("run_id");

  if (!run_id) {
    return json({ status: "No run_id provided" }, { status: 400 });
  }

  const repoConfig = {
    owner: "sjoerdbeentjes",
    repo: "podcast-generator-back-end",
  };

  const workflow = await octokit.rest.actions.getWorkflowRun({
    ...repoConfig,
    run_id: Number(run_id),
  });

  return json(workflow);
}
