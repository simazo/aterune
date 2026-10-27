import { ClipboardListIcon, UserIcon } from '@/components/icons';
import { NotificationBell } from '@/components/notification-bell';
import { Icon, MessageCircleIcon, SearchIcon } from '@/components/ui/icon';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

type TabIconProps = {
  as: ComponentProps<typeof Icon>['as'];
  color: string;
};

// 色は選択中かどうかに応じて react-navigation が渡してくるので、それをそのまま Icon に渡す。
// 大きさは react-navigation の標準（24px）に合わせて xl に固定する（Icon の size は数値を受け付けないため）
function TabIcon({ as, color }: TabIconProps) {
  return <Icon as={as} color={color} size="xl" />;
}

// タブは全員に同じものを出す。占い師だけの機能（お悩みへの応募など）は、各画面の中で profiles.is_teller を見て出し分ける。
// どのタブでも、ヘッダー右上に通知のベルを出す
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: () => <NotificationBell /> }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '占い師を探す',
          tabBarIcon: ({ color }) => <TabIcon as={SearchIcon} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="concerns"
        options={{
          title: 'お悩みを探す',
          tabBarIcon: ({ color }) => <TabIcon as={ClipboardListIcon} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'やり取り',
          tabBarIcon: ({ color }) => <TabIcon as={MessageCircleIcon} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color }) => <TabIcon as={UserIcon} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
