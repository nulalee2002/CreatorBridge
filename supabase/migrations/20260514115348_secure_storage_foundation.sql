-- CreatorBridge secure storage foundation.
-- User uploaded files are private by default. Public marketing imagery belongs in /public,
-- not in user storage buckets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'creator-portfolio',
    'creator-portfolio',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
  ),
  (
    'creator-intros',
    'creator-intros',
    false,
    314572800,
    array['video/mp4', 'video/webm', 'video/quicktime']::text[]
  ),
  (
    'client-assets',
    'client-assets',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
  ),
  (
    'project-attachments',
    'project-attachments',
    false,
    209715200,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'audio/mpeg',
      'audio/wav',
      'audio/aac',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]::text[]
  ),
  (
    'project-deliveries',
    'project-deliveries',
    false,
    524288000,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'audio/mpeg',
      'audio/wav',
      'audio/aac',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/zip'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own CreatorBridge storage objects" on storage.objects;
create policy "Users can read own CreatorBridge storage objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in (
      'creator-portfolio',
      'creator-intros',
      'client-assets',
      'project-attachments',
      'project-deliveries'
    )
    and (
      owner_id = (select auth.uid())::text
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );
comment on policy "Users can read own CreatorBridge storage objects" on storage.objects
  is 'Keeps private uploads readable only by the uploading account until signed URL access is added for approved project participants.';

drop policy if exists "Users can upload to own CreatorBridge storage folder" on storage.objects;
create policy "Users can upload to own CreatorBridge storage folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in (
      'creator-portfolio',
      'creator-intros',
      'client-assets',
      'project-attachments',
      'project-deliveries'
    )
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
comment on policy "Users can upload to own CreatorBridge storage folder" on storage.objects
  is 'Requires every user upload path to start with the authenticated user id, preventing cross-account object writes.';

drop policy if exists "Users can update own CreatorBridge storage objects" on storage.objects;
create policy "Users can update own CreatorBridge storage objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in (
      'creator-portfolio',
      'creator-intros',
      'client-assets',
      'project-attachments',
      'project-deliveries'
    )
    and (
      owner_id = (select auth.uid())::text
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
  with check (
    bucket_id in (
      'creator-portfolio',
      'creator-intros',
      'client-assets',
      'project-attachments',
      'project-deliveries'
    )
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
comment on policy "Users can update own CreatorBridge storage objects" on storage.objects
  is 'Allows safe upsert behavior only inside the user-owned folder.';

drop policy if exists "Users can delete own CreatorBridge storage objects" on storage.objects;
create policy "Users can delete own CreatorBridge storage objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in (
      'creator-portfolio',
      'creator-intros',
      'client-assets',
      'project-attachments',
      'project-deliveries'
    )
    and (
      owner_id = (select auth.uid())::text
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );
comment on policy "Users can delete own CreatorBridge storage objects" on storage.objects
  is 'Prevents users from deleting files owned by another creator or client.';
