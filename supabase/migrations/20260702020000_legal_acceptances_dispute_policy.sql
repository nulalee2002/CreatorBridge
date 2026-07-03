-- Allow recording acceptance of the Dispute Policy alongside the Terms of
-- Service and Creator Agreement. The role-scoped acceptance gate records one
-- row per required document per version.
alter table public.legal_acceptances
  drop constraint if exists legal_acceptances_document_type_check;

alter table public.legal_acceptances
  add constraint legal_acceptances_document_type_check
  check (document_type in ('terms_of_service', 'creator_agreement', 'dispute_policy'));
