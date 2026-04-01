import cron from 'node-cron';
const jobs = new Map();

export const schedule = (name, expression, fn) => {
  if (jobs.has(name)) jobs.get(name).stop();
  const job = cron.schedule(expression, async () => {
    console.log(`[Cron] ${name}`);
    try { await fn(); }
    catch (err) { console.error(` error [Cron] ${name}:`, err.message); }
  });
  jobs.set(name, job);
  console.log(`Scheduled: ${name} → ${expression}`);
};

export const stopAll = () => {
  jobs.forEach((job, name) => { job.stop(); });
  jobs.clear();
};
