import { LoaderFunctionArgs, json } from "@remix-run/node";
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

  const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
    ...repoConfig,
    run_id: Number(run_id),
  });

  if (artifacts.data.artifacts) {
    const artifact = artifacts.data.artifacts[0];

    const download = await octokit.rest.actions.downloadArtifact({
      ...repoConfig,
      artifact_id: artifact.id,
      archive_format: "zip",
      archive_name: "podcast.zip",
    });

    return json({ url: download.url });
  }

  return json({});
}
