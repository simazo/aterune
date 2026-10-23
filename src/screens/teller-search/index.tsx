import { listTags } from '@/api/tags';
import { searchTellers } from '@/api/tellers';
import { SelectableButton } from '@/components/selectable-button';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { TagCategory, TellerSearchResult, TellerSortOrder } from '@/types';
import { CATEGORY_LABELS } from '@/utils/teller';
import { useEffect, useState } from 'react';
import { TagFilterSection, type TagOption } from './components/tag-filter-section';
import { TellerCard } from './components/teller-card';

const SORT_OPTIONS: { value: TellerSortOrder; label: string }[] = [
  { value: 'newest', label: '新着順' },
  { value: 'rating', label: '評価順' },
  { value: 'sessions', label: 'セッション数順' },
];

// TODO: 仮実装。件数が多いときのページ送りは未対応
export function TellerSearch() {
  const showError = useErrorToast();
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isAcceptingOnly, setIsAcceptingOnly] = useState(false);
  const [sort, setSort] = useState<TellerSortOrder>('newest');
  const [tellers, setTellers] = useState<TellerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await listTags();
      if (error) {
        showError('タグを読み込めませんでした');
        return;
      }
      setTags(data);
    })();
  }, [showError]);

  useEffect(() => {
    // 選択を素早く切り替えたとき、古い検索結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      const { data, error } = await searchTellers({ tagSlugs: selectedSlugs, isAcceptingOnly, sort });
      if (isCancelled) return;

      if (error) {
        showError('占い師を読み込めませんでした');
      } else {
        setTellers(data ?? []);
      }
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedSlugs, isAcceptingOnly, sort, showError]);

  function handleToggleTag(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-6">
      <VStack space="md">
        {(Object.keys(CATEGORY_LABELS) as TagCategory[]).map((category) => (
          <TagFilterSection
            key={category}
            label={CATEGORY_LABELS[category]}
            tags={tags.filter((tag) => tag.category === category)}
            selectedSlugs={selectedSlugs}
            onToggleTag={handleToggleTag}
          />
        ))}

        <HStack className="items-center justify-between">
          <Text size="md">受付中のみ表示</Text>
          <Switch
            value={isAcceptingOnly}
            onValueChange={setIsAcceptingOnly}
            accessibilityLabel="受付中のみ表示"
          />
        </HStack>

        {/* 選択肢が少ないので、メニューを開かずに1回のタップで切り替えられるようボタンを並べる */}
        <HStack className="flex-wrap items-center justify-between gap-2">
          <Text size="md">並び順</Text>
          <HStack space="xs">
            {SORT_OPTIONS.map((option) => (
              <SelectableButton
                key={option.value}
                label={option.label}
                isSelected={sort === option.value}
                onPress={() => setSort(option.value)}
              />
            ))}
          </HStack>
        </HStack>
      </VStack>

      {isLoading ? (
        <Spinner size="large" />
      ) : tellers.length === 0 ? (
        <Text size="md" className="text-center text-muted-foreground">
          条件に合う占い師が見つかりませんでした
        </Text>
      ) : (
        // スマホは1列、幅 768px 以上（md）は2列。カードの間隔は各カードの外側の余白（p-2）で取る
        <HStack className="-m-2 flex-wrap">
          {tellers.map((teller) => (
            <VStack key={teller.teller_id} className="w-full p-2 md:w-1/2">
              <TellerCard teller={teller} />
            </VStack>
          ))}
        </HStack>
      )}
    </ScrollView>
  );
}
