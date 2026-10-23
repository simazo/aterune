import { styled } from 'nativewind';
import type { ComponentType } from 'react';
import {
  KeyboardAwareScrollView as BaseKeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

// className / contentContainerClassName を使えるようにする（gluestack の ScrollView と同じ書き方にそろえる）。
// 部品をそのまま styled() に渡すと tsc が TS2590（型が複雑すぎる）で失敗するため、components/ui/alert-dialog と同じく
// any にして渡す。使う側の props の型は、下の Props で確かめる
const StyledKeyboardAwareScrollView = styled(
  BaseKeyboardAwareScrollView as ComponentType<any>,
  {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  },
);

type Props = KeyboardAwareScrollViewProps & {
  className?: string;
  contentContainerClassName?: string;
};

// 入力欄のある画面のスクロール。フォーカスした入力欄がキーボードに隠れないよう、自動でスクロールする。
// - keyboardShouldPersistTaps: キーボードを出したままボタンを押せるようにする
// - bottomOffset: 入力欄とキーボードの間の余白
// Web ではキーボードの処理が働かず、普通の ScrollView と同じに動く
export function KeyboardAwareScrollView(props: Props) {
  return <StyledKeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={24} {...props} />;
}
