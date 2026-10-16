import { createIcon } from '@/components/ui/icon';

// icons.tsx の Web 版。Web では素の <svg> で描画されるため、react-native-svg の Path ではなく小文字の <path> を使う

// lucide: user
export const UserIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});

UserIcon.displayName = 'UserIcon';
