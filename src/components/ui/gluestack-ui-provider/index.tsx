// gluestack-ui（main）からコピーしたもの。upstream からの変更点：
// mode が 'system' のとき、Appearance.setColorScheme に 'system' ではなく 'unspecified' を渡すようにした。
// React Native が受け付けるのは 'light' / 'dark' / 'unspecified' で、'system' を渡すとその文字列が
// そのまま useColorScheme() の戻り値になり、OS がダークでも 'dark' と判定できなくなるため。
import React, { useEffect } from 'react';
import { View, ViewProps , Appearance, ColorSchemeName } from 'react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'system',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  useEffect(() => {
    Appearance.setColorScheme((mode === 'system' ? 'unspecified' : mode) as ColorSchemeName);
  }, [mode]);

  return (
    <View
      style={[
        { flex: 1, height: '100%', width: '100%' },
        props.style,
      ]}
    >
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
