import { UserIcon } from '@/components/icons';
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

// TODO: 仮実装。相談者モードのタブのみ。
// 占い師モードの実装時に掲示板タブを足し、profiles.active_mode に応じて Tabs.Protected で出し分ける
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'さがす',
          tabBarIcon: ({ color }) => <TabIcon as={SearchIcon} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'メッセージ',
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
