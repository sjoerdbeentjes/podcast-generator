import type { ActionFunction, MetaFunction } from "@remix-run/node";
import {
  Form,
  json,
  useActionData,
  useFormAction,
  useNavigation,
} from "@remix-run/react";
import { Octokit } from "octokit";
import { useEffect, useState } from "react";

type Workflow = Awaited<
  ReturnType<Octokit["rest"]["actions"]["getWorkflow"]>
>["data"];

type Artifact = Awaited<
  ReturnType<Octokit["rest"]["actions"]["getArtifact"]>
>["data"];

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const action: ActionFunction = async ({ request }) => {
  const body = await request.formData();
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const workflowConfig = {
    owner: "sjoerdbeentjes",
    repo: "podcast-generator-back-end",
    workflow_id: "generate.yaml",
  };

  // Get current list of workflow runs
  const oldRuns = await octokit.rest.actions.listWorkflowRuns(workflowConfig);

  // Dispatch new workflow run
  await octokit.rest.actions.createWorkflowDispatch({
    ...workflowConfig,
    ref: "master",
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
    inputs: {
      url: body.get("url"),
    },
  });

  // Delay to allow the new workflow run to start
  await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds

  // Fetch the updated list of workflow runs
  const newRuns = await octokit.rest.actions.listWorkflowRuns(workflowConfig);

  // Find the new run by comparing newRuns with oldRuns
  const newRun = newRuns.data.workflow_runs.find(
    (newRun) =>
      !oldRuns.data.workflow_runs.some((oldRun) => oldRun.id === newRun.id)
  );

  return json(newRun || { error: "No new run found" });
};

export default function Index() {
  const action = useFormAction();
  const data = useActionData<Workflow>();
  const { state } = useNavigation();
  const [loading, setLoading] = useState(false);

  async function downloadArtifact(id: number) {
    const response = await fetch(`/get-artifact?run_id=${id}`);
    const artifact = (await response.json()) as Artifact;

    if (artifact.url) {
      window.location.href = artifact.url;
    }
  }

  useEffect(() => {
    if (data) {
      console.log("Run created!", data);
      setLoading(true);

      // poll endpoint until run is completed
      const interval = setInterval(async () => {
        const response = await fetch(`/check-workflow?run_id=${data.id}`);
        const run = await response.json();

        console.log("polling status", run.data);

        if (run.data.status === "completed") {
          clearInterval(interval);
          setLoading(false);

          console.log("Run completed!");

          downloadArtifact(data.id);
        }
      }, 1000);
    }
  }, [data]);

  return (
    <div>
      <h1>Podcast generator</h1>

      <Form action={action} method="POST">
        <label htmlFor="url">URL</label>
        <input
          type="text"
          name="url"
          id="url"
          disabled={loading || state === "submitting"}
        />

        <button disabled={loading || state === "submitting"}>Submit</button>

        {loading && <p>Creating podcast...</p>}
      </Form>
    </div>
  );
}
