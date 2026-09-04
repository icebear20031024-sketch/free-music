import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface StubbedRequest {
  url: string;
}

const requests: StubbedRequest[] = [];
let respondWith: (url: string) => unknown = () => ({});

const originalXHR = (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest;

const installXhrStub = () => {
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = class {
    url = '';
    status = 200;
    readyState = 4;
    responseText = '';
    onload: (() => void) | null = null;
    onreadystatechange: (() => void) | null = null;

    open(_method: string, url: string) {
      this.url = url;
    }

    send() {
      requests.push({ url: this.url });
      this.responseText = JSON.stringify(respondWith(this.url));
      setTimeout(() => {
        if (this.onload) this.onload();
        if (this.onreadystatechange) this.onreadystatechange();
      }, 1);
    }

    setRequestHeader() {}
    getAllResponseHeaders() {
      return '';
    }
  };
};

const loadHelpers = async () => {
  vi.resetModules();
  return import('./_source-helpers.cjs');
};

describe('_source-helpers lxUrl', () => {
  beforeEach(() => {
    requests.length = 0;
    delete process.env.LX_API_URLS;
    delete process.env.LX_API_URL;
    installXhrStub();
  });

  afterEach(() => {
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXHR;
  });

  it('returns the url the api reports', async () => {
    const helpers = await loadHelpers();
    respondWith = () => ({ code: 0, msg: 'success', url: 'http://cdn/song.mp3' });

    await expect(helpers.lxUrl('wy', '1', '320k')).resolves.toBe('http://cdn/song.mp3');
  });

  it('rejects panspace placeholders and unsuccessful responses', async () => {
    const helpers = await loadHelpers();
    respondWith = () => ({ code: 0, msg: '无法获取播放链接！', url: 'http://panspace.kuwo.cn/x.mp3' });

    await expect(helpers.lxUrl('kw', '2', '320k')).resolves.toBeNull();
  });

  it('stops calling an endpoint that reports the caller is blocked', async () => {
    const helpers = await loadHelpers();
    respondWith = () => ({ code: 1, msg: '禁止批量下载，请规范使用！' });

    await expect(helpers.lxUrl('kg', '3', '320k')).resolves.toBeNull();
    expect(requests).toHaveLength(1);

    // The breaker is open now, so a second song must not produce a second call.
    await expect(helpers.lxUrl('kg', '4', '320k')).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(Object.values(helpers.lxBreakerStatus())).toContain('禁止批量下载，请规范使用！');
  });

  it('tries a self-hosted endpoint before the public one', async () => {
    process.env.LX_API_URLS = 'http://127.0.0.1:9000/';
    const helpers = await loadHelpers();
    respondWith = () => ({ code: 0, url: 'http://cdn/self-hosted.mp3' });

    await expect(helpers.lxUrl('tx', '5', '320k')).resolves.toBe('http://cdn/self-hosted.mp3');
    expect(requests[0].url).toBe('http://127.0.0.1:9000/url/tx/5/320k');
  });
});

describe('_source-helpers kuwoUrl', () => {
  beforeEach(() => {
    requests.length = 0;
    installXhrStub();
  });

  afterEach(() => {
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXHR;
  });

  it('rejects the copyright-blocked placeholder clip', async () => {
    const helpers = await loadHelpers();
    respondWith = () => ({
      code: 200,
      data: { rid: 260839262, duration: 11, url: 'http://kw-er.kuwo.cn/blocked.mp3' },
    });

    await expect(helpers.kuwoUrl('228908', 'standard')).resolves.toBeNull();
  });

  it('accepts a real track', async () => {
    const helpers = await loadHelpers();
    respondWith = () => ({
      code: 200,
      data: { rid: 228908, duration: 269, url: 'http://kw-er.kuwo.cn/song.mp3' },
    });

    await expect(helpers.kuwoUrl('228908', 'standard')).resolves.toBe('http://kw-er.kuwo.cn/song.mp3');
  });
});
