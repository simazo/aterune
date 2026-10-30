import { LegalDocument } from '@/components/legal-document';
import { PRIVACY_ENACTED_AT, PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from './content';

export function Privacy() {
  return (
    <LegalDocument
      title="プライバシーポリシー"
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      enactedAt={PRIVACY_ENACTED_AT}
      updatedAt={PRIVACY_UPDATED_AT}
    />
  );
}
