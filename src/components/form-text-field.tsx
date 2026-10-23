import { FilledInput } from '@/components/filled-input';
import { FormControl, FormControlError, FormControlErrorText } from '@/components/ui/form-control';
import { InputField } from '@/components/ui/input';
import type { ComponentProps } from 'react';
import { Controller, type Control, type FieldPathByValue, type FieldValues } from 'react-hook-form';

type Props<T extends FieldValues> = {
  control: Control<T>;
  // 文字列の項目だけを指定できるようにする（入力欄の値は文字列のため）
  name: FieldPathByValue<T, string>;
} & Omit<ComponentProps<typeof InputField>, 'value' | 'onChangeText' | 'onBlur'>;

// フォーム用の1行の入力欄。react-hook-form の項目とつなぎ、入力チェックのエラーを下に出す。
// placeholder・secureTextEntry・keyboardType などは InputField にそのまま渡す
export function FormTextField<T extends FieldValues>({ control, name, ...inputProps }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <FormControl isInvalid={!!error}>
          <FilledInput>
            <InputField value={value} onChangeText={onChange} onBlur={onBlur} {...inputProps} />
          </FilledInput>
          <FormControlError>
            <FormControlErrorText>{error?.message}</FormControlErrorText>
          </FormControlError>
        </FormControl>
      )}
    />
  );
}
