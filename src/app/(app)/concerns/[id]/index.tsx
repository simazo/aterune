import { ConcernDetail } from '@/screens/concern-detail';
import { useLocalSearchParams } from 'expo-router';

export default function ConcernDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConcernDetail postId={id} />;
}
