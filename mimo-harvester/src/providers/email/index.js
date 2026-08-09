import fetch from 'node-fetch';
import config from '../../config/index.js';
import { sleep } from '../../utils/index.js';

const MAIL_TM_BASE = 'https://api.mail.tm';

/**
 * Mail.tm temporary email provider.
 */
class MailTmProvider {
  constructor() {
    this.token = null;
    this.accountId = null;
    this.address = null;
    this.password = null;
  }

  /**
   * Create a new temp email account on mail.tm.
   */
  async createAccount() {
    // Get available domains
    const domainsRes = await fetch(`${MAIL_TM_BASE}/domains`);
    const domains = await domainsRes.json();
    if (!domains['hydra:member'] || domains['hydra:member'].length === 0) {
      throw new Error('No available domains on mail.tm');
    }

    const domain = domains['hydra:member'][0].domain;
    const randomId = Math.random().toString(36).substring(2, 10);
    this.address = `mimoharvester${randomId}@${domain}`;
    this.password = `MimoH!${randomId}${Date.now()}`;

    // Create account
    const createRes = await fetch(`${MAIL_TM_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.address, password: this.password }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create mail.tm account: ${err}`);
    }

    const account = await createRes.json();
    this.accountId = account.id;

    // Get auth token
    const tokenRes = await fetch(`${MAIL_TM_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.address, password: this.password }),
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to get mail.tm token');
    }

    const tokenData = await tokenRes.json();
    this.token = tokenData.token;

    return { address: this.address, password: this.password, token: this.token };
  }

  /**
   * Wait for an email matching a filter.
   * @param {Function} filterFn - Receives message object, returns boolean
   * @param {number} timeoutMs - Max wait time
   * @param {number} pollInterval - Poll interval in ms
   */
  async waitForEmail(filterFn = () => true, timeoutMs = 120000, pollInterval = 5000) {
    if (!this.token) throw new Error('Not authenticated. Call createAccount first.');

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${MAIL_TM_BASE}/messages`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const messages = data['hydra:member'] || [];
        for (const msg of messages) {
          if (filterFn(msg)) {
            // Get full message
            const fullRes = await fetch(`${MAIL_TM_BASE}/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${this.token}` },
            });
            return await fullRes.json();
          }
        }
      }

      await sleep(pollInterval);
    }

    throw new Error('Timeout waiting for email');
  }

  /**
   * Get all messages.
   */
  async getMessages() {
    if (!this.token) throw new Error('Not authenticated');
    const res = await fetch(`${MAIL_TM_BASE}/messages`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const data = await res.json();
    return data['hydra:member'] || [];
  }

  /**
   * Get a specific message by ID.
   */
  async getMessage(id) {
    if (!this.token) throw new Error('Not authenticated');
    const res = await fetch(`${MAIL_TM_BASE}/messages/${id}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return await res.json();
  }
}

/**
 * 1secmail provider (backup).
 */
class OneSecMailProvider {
  constructor() {
    this.address = null;
    this.login = null;
    this.domain = null;
  }

  async createAccount() {
    const res = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
    const emails = await res.json();
    this.address = emails[0];
    [this.login, this.domain] = this.address.split('@');
    return { address: this.address };
  }

  async waitForEmail(filterFn = () => true, timeoutMs = 120000, pollInterval = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(
        `https://www.1secmail.com/api/v1/?action=getMessages&login=${this.login}&domain=${this.domain}`
      );
      const messages = await res.json();
      for (const msg of messages) {
        if (filterFn(msg)) {
          const fullRes = await fetch(
            `https://www.1secmail.com/api/v1/?action=readMessage&login=${this.login}&domain=${this.domain}&id=${msg.id}`
          );
          return await fullRes.json();
        }
      }
      await sleep(pollInterval);
    }
    throw new Error('Timeout waiting for email');
  }
}

/**
 * Factory: get provider by name.
 */
export function getEmailProvider(name = 'mail.tm') {
  switch (name.toLowerCase()) {
    case 'mail.tm':
      return new MailTmProvider();
    case '1secmail':
      return new OneSecMailProvider();
    default:
      return new MailTmProvider();
  }
}

export { MailTmProvider, OneSecMailProvider };
