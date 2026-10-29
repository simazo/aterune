import { LegalDocument } from '@/components/legal-document';
import { TERMS_ENACTED_AT, TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED_AT } from './content';

export function Terms() {
  return (
    <LegalDocument
      title="利用規約"
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
      enactedAt={TERMS_ENACTED_AT}
      updatedAt={TERMS_UPDATED_AT}
    />
  );
}
