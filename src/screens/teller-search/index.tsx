import { listTags } from '@/api/tags';
import { searchTellers } from '@/api/tellers';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { Tag, TagCategory, TellerSearchResult } from '@/types';
import { useEffect, useState } from 'react';
import { TellerCard } from './components/teller-card';

type TagOption = Pick<Tag, 'id' | 'category' | 'slug' | 'name'>;

const CATEGORY_LABELS: Record<TagCategory, string> = {
  divination: '占術',
  style: '回答のスタイル',
};

// TODO: 仮実装。受付中のみの絞り込み・並び順・件数が多いときのページ送りは未対応
export function TellerSearch() {
  const showError = useErrorToast();
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
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
    // showError は描画ごとに作り直されるため依存に入れない（読み込みは初回だけ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 選択を素早く切り替えたとき、古い検索結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      const { data, error } = await searchTellers(selectedSlugs);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlugs]);

  function handleToggleTag(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-6">
      <VStack space="md">
        {(Object.keys(CATEGORY_LABELS) as TagCategory[]).map((category) => (
          <VStack key={category} space="xs">
            <Heading size="sm">{CATEGORY_LABELS[category]}</Heading>
            {/* タグが多いので、種類ごとに1行で横にスクロールさせる */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack space="xs">
                {tags
                  .filter((tag) => tag.category === category)
                  .map((tag) => {
                    const isSelected = selectedSlugs.includes(tag.slug);
                    return (
                      <Button
                        key={tag.id}
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onPress={() => handleToggleTag(tag.slug)}
                      >
                        <ButtonText>{tag.name}</ButtonText>
                      </Button>
                    );
                  })}
              </HStack>
            </ScrollView>
          </VStack>
        ))}
      </VStack>

      {isLoading ? (
        <Spinner size="large" />
      ) : tellers.length === 0 ? (
        <Text size="md" className="text-center text-muted-foreground">
          条件に合う占い師が見つかりませんでした
        </Text>
      ) : (
        <VStack space="md">
          {tellers.map((teller) => (
            <TellerCard key={teller.teller_id} teller={teller} />
          ))}
        </VStack>
      )}
    </ScrollView>
  );
}
