import { Report } from '@/screens/report';
import { useLocalSearchParams } from 'expo-router';

export default function ReportScreen() {
  const { userId, userName, sessionId } = useLocalSearchParams<{
    userId: string;
    userName: string;
    sessionId?: string;
  }>();
  return (
    <Report reportedUserId={userId} reportedUserName={userName} sessionId={sessionId ?? null} />
  );
}
