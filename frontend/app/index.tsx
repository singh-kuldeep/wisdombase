import { Redirect } from "expo-router";

// Root entry: the guard in _layout handles redirects; default to the app.
export default function Index() {
  return <Redirect href="/(app)/home" />;
}
