import { useAuth } from '@/hooks/use-auth';
import { Redirect, Slot } from 'expo-router';

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
