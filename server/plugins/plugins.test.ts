import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockResponse: any = {
  code: 0,
  msg: 'success',
  url: 'http://some-cdn.com/song.mp3'
};

const originalXHR = (global as any).XMLHttpRequest;

describe('Plugins getMediaSource Error Handling with XHR Mock', () => {
  beforeEach(() => {
    // Standard robust mock of XMLHttpRequest in JSDOM environment
    (global as any).XMLHttpRequest = class {
      url: string = '';
      status: number = 200;
      readyState: number = 4;
      responseText: string = '';
      onload: (() => void) | null = null;
      onreadystatechange: (() => void) | null = null;

      open(method: string, url: string) {
        this.url = url;
      }

      send() {
        this.responseText = JSON.stringify(mockResponse);
        setTimeout(() => {
          if (this.onload) this.onload();
          if (this.onreadystatechange) this.onreadystatechange();
        }, 5);
      }

      setRequestHeader() {}
    };
  });

  afterEach(() => {
    (global as any).XMLHttpRequest = originalXHR;
  });

  it('should resolve the URL if the response has msg: "success"', async () => {
    mockResponse = {
      code: 0,
      msg: 'success',
      url: 'http://some-cdn.com/song.mp3'
    };

    const xiaoyun = await import('./xiaoyun.cjs');
    const result = await xiaoyun.getMediaSource({ id: '123' }, 'standard');
    
    expect(result).toEqual({ url: 'http://some-cdn.com/song.mp3' });
  });

  it('should throw an error and not resolve the URL if the response has msg: "无法获取播放链接！"', async () => {
    mockResponse = {
      code: 0,
      msg: '无法获取播放链接！',
      url: 'http://panspace.kuwo.cn/3cd1cdac02dcc49a289222149f0be762/6a161d62/resource/2149972737147268278.mp3'
    };

    const xiaoyun = await import('./xiaoyun.cjs');
    
    await expect(xiaoyun.getMediaSource({ id: '123' }, 'standard'))
      .rejects.toThrow('无法获取播放链接');
  });

  it('should throw an error if the URL belongs to panspace fallback even if msg is absent', async () => {
    mockResponse = {
      url: 'http://panspace.kuwo.cn/3cd1cdac02dcc49a289222149f0be762/6a161d62/resource/2149972737147268278.mp3'
    };

    const xiaoyun = await import('./xiaoyun.cjs');
    
    await expect(xiaoyun.getMediaSource({ id: '123' }, 'standard'))
      .rejects.toThrow('无法获取播放链接');
  });
});
