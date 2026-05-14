import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { NaverBlogDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/naver-blog.dto';
import { Tool } from '@gitroom/nestjs-libraries/integrations/tool.decorator';

interface NaverBlogCredentials {
  bridgeUrl: string;
  bridgeToken: string;
  username: string;
  password: string;
}

interface BridgeEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  retryAfterMs?: number;
}

const decodeCredentials = (token: string): NaverBlogCredentials =>
  JSON.parse(Buffer.from(token, 'base64').toString());

const bridgeFetch = async <T>(
  creds: NaverBlogCredentials,
  path: string,
  init: RequestInit = {},
): Promise<BridgeEnvelope<T>> => {
  const url = `${creds.bridgeUrl.replace(/\/$/, '')}${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.bridgeToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return (await resp.json()) as BridgeEnvelope<T>;
};

export class NaverBlogProvider extends SocialAbstract implements SocialProvider {
  identifier = 'naver-blog';
  name = 'Naver Blog';
  isBetweenSteps = false;
  editor = 'html' as const;
  scopes = [] as string[];
  override maxConcurrentJob = 1;
  dto = NaverBlogDto;

  maxLength(): number {
    return 100000;
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return {
      url: state,
      codeVerifier: makeId(10),
      state,
    };
  }

  async refreshToken(_refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  override handleErrors(
    body: string,
  ):
    | { type: 'refresh-token' | 'bad-body' | 'retry'; value: string }
    | undefined {
    if (body.includes('UNAUTHORIZED') || body.includes('Invalid credentials')) {
      return {
        type: 'refresh-token',
        value: 'Naver Bridge unauthorized — re-authenticate Naver Blog integration',
      };
    }
    if (body.includes('RATE_LIMIT')) {
      return {
        type: 'retry',
        value: 'Naver Bridge rate limit reached — schedule will retry later',
      };
    }
    if (body.includes('captcha') || body.includes('CAPTCHA')) {
      return {
        type: 'bad-body',
        value: 'Naver Blog captcha detected — manual login required',
      };
    }
    return undefined;
  }

  async customFields() {
    return [
      {
        key: 'bridgeUrl',
        label: 'Bridge URL',
        validation: `/^https?:\\/\\/.+$/`,
        type: 'text' as const,
      },
      {
        key: 'bridgeToken',
        label: 'Bridge Token',
        validation: `/.+/`,
        type: 'password' as const,
      },
      {
        key: 'username',
        label: 'Naver ID',
        validation: `/.+/`,
        type: 'text' as const,
      },
      {
        key: 'password',
        label: 'Naver Password',
        validation: `/.+/`,
        type: 'password' as const,
      },
    ];
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails | string> {
    try {
      const creds = decodeCredentials(params.code);

      const loginResp = await bridgeFetch<{
        provider: string;
        loggedIn: boolean;
        blogId: string;
        blogUrl: string;
      }>(creds, '/naver/login', {
        method: 'POST',
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
        }),
      });

      if (!loginResp.ok || !loginResp.data?.loggedIn) {
        return 'Invalid credentials';
      }

      return {
        refreshToken: '',
        expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
        accessToken: params.code,
        id: `naver_${loginResp.data.blogId}`,
        name: loginResp.data.blogId,
        picture: '',
        username: creds.username,
      };
    } catch (err) {
      console.error('[naver-blog] authenticate failed', err);
      return 'Invalid credentials';
    }
  }

  @Tool({
    description: 'Get list of Naver Blog categories for the connected account',
    dataSchema: [],
  })
  async listCategories(token: string) {
    const creds = decodeCredentials(token);
    const resp = await bridgeFetch<{
      provider: string;
      categories: { name: string; id: number }[];
    }>(creds, '/naver/list-categories', {
      method: 'GET',
      headers: {
        'X-Naver-Username': creds.username,
        'X-Naver-Password': creds.password,
      },
    });

    if (!resp.ok) {
      throw new Error(resp.message || 'Failed to fetch categories');
    }
    return resp.data?.categories || [];
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<NaverBlogDto>[],
    _integration: Integration,
  ): Promise<PostResponse[]> {
    const creds = decodeCredentials(accessToken);
    const detail = postDetails[0];
    const settings = detail.settings;

    const mediaTags = (detail.media || [])
      .map((m: any) => `<p><img src="${m.path}" alt="" /></p>`)
      .join('');
    const content = `${mediaTags}${detail.message || ''}`;

    const resp = await bridgeFetch<{
      provider: string;
      mode: string;
      title: string;
      url: string;
    }>(creds, '/naver/publish', {
      method: 'POST',
      body: JSON.stringify({
        title: settings.title,
        content,
        visibility: settings.visibility || 'public',
        category: settings.categoryId,
        tags: settings.tags || '',
        username: creds.username,
        password: creds.password,
      }),
    });

    if (!resp.ok) {
      throw new Error(resp.message || resp.error || 'Naver publish failed');
    }

    const url = resp.data?.url || '';
    const postId = url.split('/').pop() || makeId(10);

    return [
      {
        id: detail.id,
        status: 'completed',
        postId,
        releaseURL: url,
      },
    ];
  }
}
