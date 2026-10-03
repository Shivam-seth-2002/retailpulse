const EventEmitter = require('events');
const queue = require('./queue');
const { StateMachine, STATES } = require('../dataStructures/StateMachine');
const jobRepo = require('../db/repositories/jobRepo');
const config = require('../config');
const logger = require('../utils/logger');
const definitions = require('./definitions');

// Import workers
const csvImport = require('./workers/csvImport.worker');
const dailyReport = require('./workers/dailyReport.worker');
const restockAlert = require('./workers/restockAlert.worker');

const workers = {
  CSV_IMPORT: csvImport,
  DAILY_REPORT: dailyReport,
  RESTOCK_ALERT: restockAlert
};

class Orchestrator extends EventEmitter {
  constructor() {
    super();
    this.stateMachine = new StateMachine({
      onTransition: (job, from, to) => {
        logger.debug(`Job ${job.id} transitioned from ${from} to ${to}`);
        // The orchestrator handles DB updates itself for efficiency/batching,
        // but stateMachine ensures valid transitions.
      }
    });
    
    this.runningJobs = new Map();
    this.isShuttingDown = false;
    this.timer = null;
    this.schedulerTimer = null;
  }

  start() {
    logger.info('Starting workflow orchestrator');
    this.recoverJobs();
    this.loop();
    
    if (config.jobs.enableScheduler) {
      this.startScheduler();
    }
  }

  startScheduler() {
    this.schedulerTimer = setInterval(() => {
      this.enqueue({
        type: 'DAILY_REPORT',
        priority: 0,
        payload: { date: new Date().toISOString().split('T')[0] }
      });
    }, config.jobs.dailyReportIntervalMs);
  }

  recoverJobs() {
    // Re-enqueue PENDING and RETRYING
    const pendingJobs = jobRepo.findByStatus(['PENDING', 'RETRYING']);
    for (const job of pendingJobs) {
      queue.enqueue({ id: job.job_id, ...job }, job.priority);
    }
    
    // Mark old RUNNING jobs as RETRYING and enqueue
    const runningJobs = jobRepo.findAll('RUNNING');
    for (const job of runningJobs) {
      if (job.attempts < config.jobs.maxRetries) {
        job.status = 'RETRYING';
        jobRepo.updateState(job.job_id, { status: 'RETRYING' });
        queue.enqueue({ id: job.job_id, ...job }, job.priority);
      } else {
        jobRepo.updateState(job.job_id, { status: 'FAILED', error: 'Crashed while running and max retries exceeded' });
      }
    }
    
    logger.info(`Recovered ${pendingJobs.length + runningJobs.length} jobs`);
  }

  async loop() {
    if (this.isShuttingDown) return;

    while (this.runningJobs.size < config.jobs.concurrency && !queue.isEmpty()) {
      const jobItem = queue.dequeue();
      const job = jobRepo.findById(jobItem.id);
      
      if (!job) continue;
      
      this.runningJobs.set(job.job_id, this.runJob(job));
    }
    
    this.timer = setTimeout(() => this.loop(), 100);
  }

  async runJob(job) {
    try {
      this.stateMachine.transition({ status: job.status }, STATES.RUNNING);
      jobRepo.updateState(job.job_id, { status: STATES.RUNNING });
      this.emit('job:started', job);
      
      const steps = definitions[job.type];
      const worker = workers[job.type];
      
      if (!steps || !worker) {
        throw new Error(`Unknown job type: ${job.type}`);
      }
      
      let context = { 
        jobId: job.job_id, 
        payload: job.payload,
        result: job.result || {}
      };
      
      // Find starting step index
      let startIndex = 0;
      if (job.current_step) {
        startIndex = steps.indexOf(job.current_step);
        if (startIndex === -1) startIndex = 0;
      }
      
      for (let i = startIndex; i < steps.length; i++) {
        const stepName = steps[i];
        
        jobRepo.updateState(job.job_id, { current_step: stepName });
        this.emit('job:step', { job, step: stepName });
        
        if (typeof worker[stepName] === 'function') {
          await worker[stepName](context);
        } else {
          logger.warn(`Worker missing step function: ${stepName}`);
        }
      }
      
      jobRepo.updateState(job.job_id, { 
        status: STATES.COMPLETED, 
        result: context.result,
        current_step: 'done'
      });
      this.emit('job:completed', job);
      
    } catch (err) {
      logger.error(`Job ${job.job_id} failed`, { error: err.message });
      const attempts = job.attempts + 1;
      
      if (attempts < config.jobs.maxRetries) {
        jobRepo.updateState(job.job_id, { 
          status: STATES.RETRYING, 
          error: err.message,
          attempts
        });
        
        // Exponential backoff
        const backoff = config.jobs.backoffBaseMs * Math.pow(2, attempts - 1);
        setTimeout(() => {
          if (!this.isShuttingDown) {
            queue.enqueue({ id: job.job_id, ...job }, job.priority);
          }
        }, backoff);
        
      } else {
        jobRepo.updateState(job.job_id, { 
          status: STATES.FAILED, 
          error: err.message,
          attempts
        });
        this.emit('job:failed', { job, error: err.message });
      }
    } finally {
      this.runningJobs.delete(job.job_id);
    }
  }

  enqueue(jobData) {
    const crypto = require('crypto');
    const id = crypto.randomUUID();
    
    const job = {
      id,
      job_id: id,
      type: jobData.type,
      status: STATES.PENDING,
      priority: jobData.priority || 0,
      payload: jobData.payload
    };
    
    jobRepo.create(job);
    queue.enqueue(job, job.priority);
    
    return id;
  }
  
  cancel(jobId) {
    const job = jobRepo.findById(jobId);
    if (!job || job.status !== STATES.PENDING) {
      return false;
    }
    
    if (queue.remove(jobId)) {
      jobRepo.updateState(jobId, { status: STATES.CANCELLED });
      return true;
    }
    return false;
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    
    if (this.runningJobs.size > 0) {
      logger.info(`Waiting for ${this.runningJobs.size} jobs to finish...`);
      await Promise.all(this.runningJobs.values());
    }
  }
}

// Singleton orchestrator
const orchestrator = new Orchestrator();

module.exports = orchestrator;
