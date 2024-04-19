import type { ActionFunction, MetaFunction } from "@remix-run/node";
import {
  Form as RemixForm,
  json,
  useActionData,
  useFormAction,
  useNavigation,
} from "@remix-run/react";
import { Octokit } from "octokit";
import { useEffect, useRef, useState } from "react";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { Button } from "../components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";

type Workflow = Awaited<
  ReturnType<Octokit["rest"]["actions"]["getWorkflow"]>
>["data"];

type Artifact = Awaited<
  ReturnType<Octokit["rest"]["actions"]["getArtifact"]>
>["data"];

export const meta: MetaFunction = () => {
  return [
    { title: "Podcast generator" },
    { name: "description", content: "Podcast generator" },
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
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function getArtifect(id: number) {
    const response = await fetch(`/get-artifact?run_id=${id}`);
    const artifact = (await response.json()) as Artifact;

    if (artifact.url) {
      setDownloadUrl(artifact.url);

      formRef.current?.reset();
    }
  }

  async function downloadArtifactFromZip(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const zipReader = new ZipReader(new BlobReader(blob));

    const entries = await zipReader.getEntries();

    for (const entry of entries) {
      if (entry.filename.endsWith(".mp3")) {
        if (!entry.getData) {
          console.error("Entry does not have a getData method");
          return;
        }
        const mp3Blob = await entry.getData(new BlobWriter());
        const mp3Url = URL.createObjectURL(mp3Blob);

        const a = document.createElement("a");
        a.href = mp3Url;
        a.download = "podcast.mp3";
        a.click();
      }
    }
  }

  function handleSubmit() {
    setDownloadUrl(null);
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

          await getArtifect(data.id);

          setLoading(false);
        }
      }, 1000);
    }
  }, [data]);

  return (
    <div className="flex flex-col h-screen justify-center p-6">
      <Card className="w-full max-w-lg m-auto">
        <header className="p-6">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Podcast Generator
          </h1>
        </header>

        <RemixForm
          ref={formRef}
          action={action}
          method="POST"
          className="p-6 pt-0 grid w-full items-center gap-4"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              htmlFor="url"
            >
              URL
            </label>

            <Input
              type="text"
              name="url"
              id="url"
              disabled={loading || state === "submitting"}
            />
          </div>

          <Button
            disabled={loading || state === "submitting"}
            className="justify-self-start"
          >
            Submit
          </Button>
        </RemixForm>

        {(downloadUrl || loading) && (
          <div className="flex flex-col gap-4 p-6 border-t items-start">
            {loading && (
              <p>Creating podcast... (this may take a few minutes)</p>
            )}

            {downloadUrl && <p>Your podcast has been created! </p>}

            {downloadUrl && (
              <Button
                variant="secondary"
                onClick={() => downloadArtifactFromZip(downloadUrl)}
              >
                Download mp3
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
