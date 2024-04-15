import type { ActionFunction, MetaFunction } from "@remix-run/node";
import {
  Form,
  json,
  useActionData,
  useFormAction,
  useNavigation,
} from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const action: ActionFunction = async ({ request }) => {
  const body = await request.formData();

  console.log(body);

  return json({ action_url: `test` });
};

export default function Index() {
  const action = useFormAction();
  const data = useActionData();
  const { state } = useNavigation();

  console.log(state, data);

  return (
    <div>
      <h1>Podcast generator</h1>

      <Form action={action} method="POST">
        <label htmlFor="url">URL</label>
        <input
          type="text"
          name="url"
          id="url"
          disabled={state === "submitting"}
        />

        <button>Submit</button>
      </Form>
    </div>
  );
}
