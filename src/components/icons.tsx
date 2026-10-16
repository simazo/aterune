import { createIcon } from '@/components/ui/icon';
import { Path } from 'react-native-svg';

// gluestack-ui の付属アイコンに無いものを、components/ui/icon の createIcon で定義する。
// パスは lucide（ISC ライセンス）から借りている。Web 版は icons.web.tsx（Web では素の <svg> で描画されるため小文字の <path> を使う）

// lucide: user
export const UserIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});

UserIcon.displayName = 'UserIcon';
