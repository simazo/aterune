import { useAuth } from '@/hooks/use-auth';
import { Redirect, Slot } from 'expo-router';

export default function AuthLayout() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}
