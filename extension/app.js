import * as store from './lib/store.js';
import * as browser from './lib/browser.js';
import { createController } from './lib/controller.js';
import { normalizeBrazilUrl, validateSearchDate } from './lib/search-url.js';
import { downloadCsv, downloadReport } from './lib/download.js';

const byId = (id) => document.getElementById(id);
const elements = Object.fromEntries(['search-form', 'search-url', 'search-date', 'start', 'message', 'counts',
  'progress', 'pause', 'resume', 'cancel', 'csv', 'report', 'delete', 'saved-jobs', 'error'].map((id) => [id, byId(id)]));
let currentJob = null;
let starting = false;

function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function render(job) {
  currentJob = job;
  const active = job?.status === 'running';
  elements.start.disabled = starting || active;
  elements.pause.hidden = !active;
  elements.cancel.hidden = !active;
  elements.resume.hidden = !job || !['paused', 'error'].includes(job.status);
  elements.csv.hidden = !job || (job.status !== 'completed' && job.resultCount === 0);
  elements.report.hidden = !job;
  elements.delete.hidden = !job || active;
  elements['saved-jobs'].disabled = active;
  elements.error.hidden = !job?.lastError;
  elements.error.textContent = job?.lastError?.message || '';
  if (!job) {
    elements.message.textContent = 'Pronto para começar.';
    elements.counts.textContent = '';
    elements.progress.hidden = true;
    return;
  }
  const labels = { running: 'Coleta em andamento.', paused: 'Coleta pausada. Você pode retomar.',
    completed: 'Coleta concluída. A planilha está pronta.', cancelled: 'Coleta cancelada.',
    error: 'A coleta foi interrompida. Leia o detalhe abaixo.' };
  elements.message.textContent = labels[job.status] || 'Coleta pronta.';
  const total = job.expectedTotal === null ? 'a identificar' : job.expectedTotal;
  elements.counts.textContent = `Resultados: ${job.resultCount}/${total}. Artigos processados: ${job.processedCount}/${job.resultCount}. Metadados detalhados: ${job.enrichedCount}. Falhas: ${job.failedCount}.`;
  elements.progress.hidden = job.expectedTotal === null || job.expectedTotal === 0;
  elements.progress.max = Math.max(1, job.expectedTotal || 1);
  elements.progress.value = job.phase === 'results' ? job.resultCount : job.processedCount;
}

async function refreshJobs() {
  const jobs = await store.listJobs();
  const select = elements['saved-jobs'];
  select.replaceChildren();
  if (!jobs.length) select.add(new Option('Nenhuma coleta salva', ''));
  for (const job of jobs) {
    const name = new URL(job.normalizedUrl).searchParams.get('q') || 'Pesquisa';
    select.add(new Option(`${name.slice(0, 55)} · ${job.searchDate} · ${job.status}`, job.id));
  }
  select.value = currentJob?.id || '';
}

const controller = createController({ browser, store, onProgress: (job) => {
  render(job);
  void refreshJobs().catch(message);
} });

function message(error) {
  elements.error.hidden = false;
  elements.error.textContent = String(error?.message || error);
}

async function initialize() {
  elements['search-date'].value = localToday();
  const source = new URL(location.href).searchParams.get('source');
  if (source) elements['search-url'].value = source;
  const previous = await store.getLatestJob();
  if (previous?.status === 'running') render(await store.setJobStatus(previous.id, 'paused'));
  else render(previous);
  await refreshJobs();
}

elements['search-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  if (starting || controller.activeJobId) return;
  starting = true;
  elements.start.disabled = true;
  elements.error.hidden = true;
  try {
    const previous = await store.getLatestJob();
    if (previous && !['completed', 'cancelled'].includes(previous.status) &&
        !confirm('Há uma coleta anterior ainda não concluída. Iniciar outra pesquisa manterá os dados anteriores neste navegador. Continuar?')) return;
    const sourceUrl = elements['search-url'].value.trim();
    const normalizedUrl = normalizeBrazilUrl(sourceUrl);
    const searchDate = validateSearchDate(elements['search-date'].value);
    elements.message.textContent = 'Iniciando coleta...';
    void controller.start({ sourceUrl, normalizedUrl, searchDate }).catch(message);
  } catch (error) { message(error); }
  finally { starting = false; elements.start.disabled = Boolean(controller.activeJobId); }
});

elements.pause.addEventListener('click', () => controller.pause());
elements.cancel.addEventListener('click', () => controller.cancel());
elements.resume.addEventListener('click', () => {
  if (currentJob) void controller.resume(currentJob.id).catch(message);
});
elements.csv.addEventListener('click', async () => {
  try { await downloadCsv(currentJob, await store.listRecords(currentJob.id)); }
  catch (error) { message(error); }
});
elements.report.addEventListener('click', async () => {
  try { await downloadReport(currentJob); }
  catch (error) { message(error); }
});
elements['saved-jobs'].addEventListener('change', async () => {
  if (controller.activeJobId) return;
  render(await store.getJob(elements['saved-jobs'].value));
});
elements.delete.addEventListener('click', async () => {
  if (!currentJob || controller.activeJobId) return;
  if (!confirm('Apagar esta coleta e seus registros deste navegador? Baixe os arquivos antes se quiser guardá-los.')) return;
  await store.deleteJob(currentJob.id);
  render(await store.getLatestJob());
  await refreshJobs();
});

initialize().catch(message);
