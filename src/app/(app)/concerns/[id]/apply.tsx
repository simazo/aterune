import { ConcernApply } from '@/screens/concern-apply';
import { useLocalSearchParams } from 'expo-router';

export default function ConcernApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConcernApply postId={id} />;
}
