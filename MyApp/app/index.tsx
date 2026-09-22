import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to Login screen when app opens
  return <Redirect href="/(auth)/login" />;
}
