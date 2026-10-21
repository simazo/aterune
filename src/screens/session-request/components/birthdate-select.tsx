import { FilledSelect, type SelectOption } from '@/components/filled-select';
import { HStack } from '@/components/ui/hstack';
import { getMaxDay, parseDateString, toDateString } from '@/utils/date';
import { useState } from 'react';

// 年の選択肢に出す範囲（今年から何年前まで）
const BIRTH_YEAR_RANGE = 100;

const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: String(i + 1),
}));

type Props = {
  // 'YYYY-MM-DD'。未選択・選び途中は ''
  value: string;
  onChange: (value: string) => void;
};

// 生年月日を年・月・日の3つのセレクトボックスで選ぶ。日の選択肢は、選んだ年・月にある日だけにする。
// 3つとも選んだときだけ 'YYYY-MM-DD' を、選び途中なら '' を onChange に渡す。
// value は最初の表示にだけ使う（FilledSelect は外から別の値へ切り替えても表示が追従しないため）
export function BirthdateSelect({ value, onChange }: Props) {
  const initial = parseDateString(value);
  const [year, setYear] = useState<number | null>(initial?.year ?? null);
  const [month, setMonth] = useState<number | null>(initial?.month ?? null);
  const [day, setDay] = useState<number | null>(initial?.day ?? null);

  const currentYear = new Date().getFullYear();
  const yearOptions: SelectOption[] = Array.from({ length: BIRTH_YEAR_RANGE + 1 }, (_, i) => ({
    label: `${currentYear - i}年`,
    value: String(currentYear - i),
  }));
  const dayOptions: SelectOption[] = Array.from({ length: getMaxDay(year, month) }, (_, i) => ({
    label: `${i + 1}日`,
    value: String(i + 1),
  }));

  // 年・月を変えて、選んでいた日がその月に無くなったら（2024年2月29日 → 2023年 など）、日を未選択に戻す
  function update(nextYear: number | null, nextMonth: number | null, nextDay: number | null) {
    const validDay = nextDay !== null && nextDay <= getMaxDay(nextYear, nextMonth) ? nextDay : null;
    setYear(nextYear);
    setMonth(nextMonth);
    setDay(validDay);
    onChange(
      nextYear !== null && nextMonth !== null && validDay !== null
        ? toDateString(nextYear, nextMonth, validDay)
        : ''
    );
  }

  return (
    <HStack space="sm">
      <FilledSelect
        className="flex-[3]"
        options={yearOptions}
        value={year === null ? null : String(year)}
        onValueChange={(selected) => update(Number(selected), month, day)}
        placeholder="年"
      />
      <FilledSelect
        className="flex-[2]"
        options={MONTH_OPTIONS}
        value={month === null ? null : String(month)}
        onValueChange={(selected) => update(year, Number(selected), day)}
        placeholder="月"
      />
      <FilledSelect
        className="flex-[2]"
        options={dayOptions}
        value={day === null ? null : String(day)}
        onValueChange={(selected) => update(year, month, Number(selected))}
        placeholder="日"
      />
    </HStack>
  );
}
