import { test, expect } from '@playwright/test';
import { authFile, cleanupQaProjects, seedCompletionProjects, signInQa } from './helpers/qa.js';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function openProject(page, project) {
  await page.goto(`/projects?project=${project.id}`);
  await expect(page.getByText(project.title, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function acknowledgeProjectGuide(page) {
  const guideHeading = page.getByText('Protected project guide', { exact: true });
  const acknowledgeButton = page.getByRole('button', { name: 'I understand the project flow' });
  await expect(acknowledgeButton).toBeVisible({ timeout: 10_000 });
  await acknowledgeButton.click();
  await expect(guideHeading).toHaveCount(0, { timeout: 10_000 });
}

async function submitExternalDelivery(page, project, version) {
  await openProject(page, project);
  await expect(page.locator(`[data-project-id="${project.id}"]`)).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder('Folder label').fill(`Finished delivery v${version}`);
  await page.getByPlaceholder('https://drive.google.com or Dropbox link').fill(`https://drive.google.com/drive/folders/creatorbridge-e2e-v${version}`);
  await page.getByPlaceholder('Delivery notes for the client').fill(`CreatorBridge browser-verified final delivery version ${version}.`);
  await page.getByLabel(/I kept my own copy/).check();
  await page.getByRole('button', { name: 'Submit final delivery' }).click();
  await expect(page.getByText(`Version ${version}`, { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function requestRevision(page, project, ordinal) {
  await openProject(page, project);
  await expect(page.getByText(new RegExp(`${3 - ordinal} included remaining`))).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Request revision', exact: true }).click();
  await page.getByPlaceholder('Describe the requested changes').fill(`Included revision ${ordinal}: adjust the final color treatment and export naming while preserving the approved scope.`);
  await page.getByRole('button', { name: 'Submit revision request' }).click();
  await expect(page.getByRole('button', { name: 'Submit revision request' })).toHaveCount(0, { timeout: 20_000 });
}

test('formal delivery, two included revisions, paid lock, holds, isolation, and payment attention work end to end', async ({ browser, request }) => {
  const fixture = await seedCompletionProjects();
  const [project, untouchedProject] = fixture.projects;
  const creatorContext = await browser.newContext({ storageState: authFile('creator') });
  const clientContext = await browser.newContext({ storageState: authFile('client') });
  const creatorPage = await creatorContext.newPage();
  const clientPage = await clientContext.newPage();

  try {
    await creatorPage.addInitScript(() => {
      const blobSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
      Object.defineProperty(File.prototype, 'size', {
        configurable: true,
        get() { return this.name === 'over-five-gigabytes.mov' ? 5_000_000_001 : blobSize.call(this); },
      });
    });
    await openProject(creatorPage, project);
    await acknowledgeProjectGuide(creatorPage);
    await creatorPage.locator('input[type="file"]').setInputFiles({
      name: 'over-five-gigabytes.mov',
      mimeType: 'video/quicktime',
      buffer: Buffer.from('mocked upload metadata'),
    });
    await expect(creatorPage.getByText('Direct uploads have a combined 5 GB limit.')).toBeVisible();

    await submitExternalDelivery(creatorPage, project, 1);
    const { data: firstDeliveries, error: firstDeliveryError } = await fixture.admin
      .from('project_deliveries').select('id,version,status').eq('project_id', project.id);
    expect(firstDeliveryError).toBeNull();
    expect(firstDeliveries).toHaveLength(1);

    const anonymousDownload = await request.post(`${process.env.VITE_SUPABASE_URL}/functions/v1/create-delivery-download`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY },
      data: { deliveryItemId: '00000000-0000-0000-0000-000000000000' },
    });
    expect([401, 403]).toContain(anonymousDownload.status());

    await openProject(clientPage, project);
    await acknowledgeProjectGuide(clientPage);
    await requestRevision(clientPage, project, 1);
    let { data: holds } = await fixture.admin.from('project_delivery_holds').select('hold_type,active').eq('delivery_id', firstDeliveries[0].id);
    expect(holds?.some(hold => hold.hold_type === 'revision' && hold.active)).toBeTruthy();

    await submitExternalDelivery(creatorPage, project, 2);
    await requestRevision(clientPage, project, 2);
    await submitExternalDelivery(creatorPage, project, 3);

    await openProject(clientPage, project);
    await expect(clientPage.getByText('Additional revision required')).toBeVisible();
    await expect(clientPage.getByRole('button', { name: 'Purchase one revision for $50.00' })).toBeVisible();
    await expect(clientPage.getByText(/Pay exactly \$50\.00/)).toBeVisible();

    const { data: untouchedDeliveries } = await fixture.admin
      .from('project_deliveries').select('id').eq('project_id', untouchedProject.id);
    expect(untouchedDeliveries).toEqual([]);

    const { client: creatorApi } = await signInQa('creator');
    const firstConversation = await creatorApi.rpc('get_or_create_project_conversation', { p_project_id: project.id });
    const secondConversation = await creatorApi.rpc('get_or_create_project_conversation', { p_project_id: untouchedProject.id });
    expect(firstConversation.error).toBeNull();
    expect(secondConversation.error).toBeNull();
    expect(firstConversation.data.conversation_id).not.toBe(secondConversation.data.conversation_id);
    await creatorApi.auth.signOut({ scope: 'local' });

    const reviewStartedAt = new Date().toISOString();
    const reviewDeadlineAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const { data: disputeDelivery, error: disputeDeliveryError } = await fixture.admin.from('project_deliveries').insert({
      project_id: untouchedProject.id,
      creator_user_id: firstConversation.data.creator_user_id,
      status: 'draft',
      note: 'Disposable delivery used to verify the dispute hold path.',
      idempotency_key: `e2e-dispute-${Date.now()}`,
    }).select('id').single();
    expect(disputeDeliveryError).toBeNull();
    const { error: disputeItemError } = await fixture.admin.from('project_delivery_items').insert({
      delivery_id: disputeDelivery.id,
      item_type: 'external',
      label: 'QA dispute delivery',
      external_url: 'https://drive.google.com/drive/folders/creatorbridge-e2e-dispute',
      size_bytes: 0,
      upload_status: 'uploaded',
      uploaded_at: reviewStartedAt,
    });
    expect(disputeItemError).toBeNull();
    const { error: finalizeDisputeDeliveryError } = await fixture.admin.from('project_deliveries').update({
      version: 1,
      status: 'under_review',
      review_started_at: reviewStartedAt,
      review_deadline_at: reviewDeadlineAt,
      submitted_at: reviewStartedAt,
    }).eq('id', disputeDelivery.id);
    expect(finalizeDisputeDeliveryError).toBeNull();
    await fixture.admin.from('projects').update({ status: 'delivered', delivered_at: reviewStartedAt }).eq('id', untouchedProject.id);

    await openProject(clientPage, untouchedProject);
    await acknowledgeProjectGuide(clientPage);
    await clientPage.getByRole('button', { name: 'Open dispute' }).first().click();
    await clientPage.getByRole('button', { name: 'Technical quality issues' }).click();
    await clientPage.getByPlaceholder(/Describe the issue in detail/).fill('This disposable QA dispute contains enough detail to validate that project review stops, funds remain held, and neither party can bypass the formal resolution workflow.');
    await clientPage.getByRole('button', { name: 'Submit Dispute' }).click();
    await expect(clientPage.getByRole('heading', { name: 'Dispute Submitted' })).toBeVisible({ timeout: 20_000 });
    const { data: disputeHolds } = await fixture.admin.from('project_delivery_holds').select('hold_type,active').eq('delivery_id', disputeDelivery.id);
    expect(disputeHolds?.some(hold => hold.hold_type === 'dispute' && hold.active)).toBeTruthy();

    const { error: attentionError } = await fixture.admin.from('transactions').update({
      final_status: 'attention',
      final_payment_error_code: 'qa_requires_payment_method',
      final_payment_error_message: 'QA payment method needs client attention.',
      final_payment_requires_action: true,
      final_payment_attention_at: new Date().toISOString(),
    }).eq('project_id', project.id);
    expect(attentionError).toBeNull();
    const { error: statusError } = await fixture.admin.from('projects').update({ status: 'final_payment_attention' }).eq('id', project.id);
    expect(statusError).toBeNull();
    await openProject(clientPage, project);
    await expect(clientPage.locator('[data-status="final_payment_attention"]')).toBeVisible();
    await expect(clientPage.getByText(/payout is not released until Stripe confirms success/)).toBeVisible();
  } finally {
    await cleanupQaProjects(fixture.admin, fixture.projectIds, fixture.phoneTrustState);
    await Promise.allSettled([creatorContext.close(), clientContext.close()]);
  }
});
