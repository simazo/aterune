import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import type { Tag } from '@/types';
import { useState } from 'react';

export type TagOption = Pick<Tag, 'id' | 'category' | 'slug' | 'name'>;

// 閉じているときに表示するタグの数（スマホで2〜3行ほど）
const COLLAPSED_TAG_COUNT = 8;

type Props = {
  label: string;
  tags: TagOption[];
  selectedSlugs: string[];
  onToggleTag: (slug: string) => void;
};

// 1種類分のタグの絞り込み。タグが多い種類は先頭だけ表示し、「もっと見る」で全件を開く
export function TagFilterSection({ label, tags, selectedSlugs, onToggleTag }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 閉じていても、選択中のタグは隠さない（何で絞り込んでいるか分からなくならないように）
  const collapsedTags = tags.filter(
    (tag, index) => index < COLLAPSED_TAG_COUNT || selectedSlugs.includes(tag.slug)
  );
  const visibleTags = isExpanded ? tags : collapsedTags;
  const hiddenCount = tags.length - collapsedTags.length;

  return (
    <VStack space="xs">
      <Heading size="sm">{label}</Heading>
      {/* 表示するタグが見えるよう、画面の幅で折り返す */}
      <HStack className="flex-wrap" space="xs">
        {visibleTags.map((tag) => {
          const isSelected = selectedSlugs.includes(tag.slug);
          return (
            <Button
              key={tag.id}
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              onPress={() => onToggleTag(tag.slug)}
            >
              <ButtonText>{tag.name}</ButtonText>
            </Button>
          );
        })}
      </HStack>
      {/* 閉じても隠れるタグが無い（タグが少ない、または残りをすべて選択中）なら、開閉の切り替えは出さない */}
      {hiddenCount > 0 && (
        <Button
          size="sm"
          variant="link"
          className="self-start px-0"
          onPress={() => setIsExpanded((current) => !current)}
        >
          <ButtonText>{isExpanded ? '閉じる' : `もっと見る（残り${hiddenCount}件）`}</ButtonText>
        </Button>
      )}
    </VStack>
  );
}
