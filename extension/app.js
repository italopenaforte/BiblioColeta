import * as store from './lib/store.js';
import * as browser from './lib/browser.js';
import { createController } from './lib/controller.js';
import { normalizeBrazilUrl, validateSearchDate } from './lib/search-url.js';
import { downloadCsv, downloadReport } from './lib/download.js';

const byId = (id) => document.getElementById(id);
const elements = Object.fromEntries(['search-form', 'search-url', 'search-date', 'start', 'message', 'counts',
  'progress', 'pause', 'resume', 'cancel', 'csv', 'report', 'delete', 'saved-jobs', 'error',
  'copy-error', 'copy-feedback', 'partial-note'].map((id) => [id, byId(id)]));
let currentJob = null;
let starting = false;
const statusNames = { running: 'em andamento', paused: 'pausada', completed: 'concluída',
  cancelled: 'cancelada', error: 'interrompida' };

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
  elements['copy-error'].hidden = !job?.lastError;
  elements['copy-feedback'].hidden = true;
  elements['partial-note'].hidden = !job || job.status === 'completed' || job.resultCount === 0;
  if (!job) {
    elements.message.textContent = 'Pronto para começar.';
    elements.counts.textContent = '';
    elements.progress.hidden = true;
    return;
  }
  const labels = { running: job.phase === 'results' ? 'Lendo os resultados da pesquisa…' : 'Lendo os detalhes dos artigos…',
    paused: 'Coleta pausada. Você pode retomar.',
    completed: 'Coleta concluída. A planilha está pronta.', cancelled: 'Coleta cancelada.',
    error: 'A coleta parou. Leia a mensagem abaixo. Se for um erro temporário, espere um pouco e clique em Retomar.' };
  elements.message.textContent = labels[job.status] || 'Coleta pronta.';
  const total = job.expectedTotal === null ? 'total ainda não identificado' : `${job.expectedTotal} encontrados`;
  elements.counts.textContent = `${job.resultCount} artigos guardados (${total}). ${job.processedCount} de ${job.resultCount} artigos lidos em detalhes. ${job.failedCount} sem detalhes completos.`;
  elements.progress.hidden = job.expectedTotal === null || job.expectedTotal === 0;
  elements.progress.max = Math.max(1, job.expectedTotal || 1);
  elements.progress.value = job.phase === 'results' ? job.resultCount : job.processedCount;
  elements.progress.setAttribute('aria-label', job.phase === 'results' ? 'Artigos encontrados' : 'Artigos lidos em detalhes');
}

async function refreshJobs() {
  const jobs = await store.listJobs();
  const select = elements['saved-jobs'];
  select.replaceChildren();
  if (!jobs.length) select.add(new Option('Nenhuma coleta salva', ''));
  for (const job of jobs) {
    const name = new URL(job.normalizedUrl).searchParams.get('q') || 'Pesquisa';
    select.add(new Option(`${name.slice(0, 55)} · ${job.searchDate} · ${statusNames[job.status] || job.status}`, job.id));
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
  elements['copy-error'].hidden = false;
  elements['copy-feedback'].hidden = true;
}

elements['copy-error'].addEventListener('click', async () => {
  try {
    const details = [
      'BiblioColeta',
      `Mensagem: ${elements.error.textContent}`,
      currentJob ? `Pesquisa: ${currentJob.sourceUrl || currentJob.normalizedUrl}` : '',
      currentJob ? `Situação: ${statusNames[currentJob.status] || currentJob.status}` : '',
      currentJob ? `Artigos guardados: ${currentJob.resultCount}; artigos lidos: ${currentJob.processedCount}` : '',
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(details);
    elements['copy-feedback'].textContent = 'Mensagem copiada. Cole no chat ou envie para quem está ajudando você.';
  } catch {
    elements['copy-feedback'].textContent = 'Não foi possível copiar. Selecione a mensagem acima e copie com Ctrl+C.';
  }
  elements['copy-feedback'].hidden = false;
});

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
  elements['copy-error'].hidden = true;
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
