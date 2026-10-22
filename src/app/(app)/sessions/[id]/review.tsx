import { SessionReview } from '@/screens/session-review';
import { useLocalSearchParams } from 'expo-router';

export default function SessionReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionReview sessionId={id} />;
}
