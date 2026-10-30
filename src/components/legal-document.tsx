import { DocumentPage } from '@/components/document-page';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

export type LegalDocumentSection = {
  heading: string;
  // 文章の段落
  paragraphs?: string[];
  // 箇条書き（段落のあとに表示する）
  items?: string[];
};

type LegalDocumentProps = {
  title: string;
  intro: string;
  sections: LegalDocumentSection[];
  enactedAt: string;
  updatedAt: string;
};

// 利用規約・プライバシーポリシーのページ。
// 本文（content.ts）を受け取り、順に並べて表示するだけにする
export function LegalDocument({ title, intro, sections, enactedAt, updatedAt }: LegalDocumentProps) {
  return (
    <DocumentPage title={title}>
      <Text size="md">{intro}</Text>

      {sections.map((section) => (
        <VStack key={section.heading} space="sm">
          <Heading size="sm">{section.heading}</Heading>
          {section.paragraphs?.map((paragraph) => (
            <Text key={paragraph} size="md">
              {paragraph}
            </Text>
          ))}
          {section.items && (
            <VStack space="xs">
              {section.items.map((item) => (
                <Text key={item} size="md">
                  ・{item}
                </Text>
              ))}
            </VStack>
          )}
        </VStack>
      ))}

      <VStack space="xs">
        <Text size="sm" className="text-muted-foreground">
          制定日：{enactedAt}
        </Text>
        {updatedAt !== enactedAt && (
          <Text size="sm" className="text-muted-foreground">
            最終改定日：{updatedAt}
          </Text>
        )}
      </VStack>
    </DocumentPage>
  );
}
