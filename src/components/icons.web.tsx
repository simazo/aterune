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

// lucide: clipboard-list（上部のクリップは rect を path に置き換えている）
export const ClipboardListIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11h4M12 16h4M8 11h.01M8 16h.01"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});

ClipboardListIcon.displayName = 'ClipboardListIcon';

// lucide: camera（レンズの circle は path に置き換えている）
export const CameraIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});

CameraIcon.displayName = 'CameraIcon';
