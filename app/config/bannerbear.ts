export interface Template {
  id: string;
  name: string;
  dimensions: { width: number; height: number };
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'general';
}

export const DEFAULT_TEMPLATE_ID = 'default-book-ad-template';

const templates: Record<string, Template> = {
  [DEFAULT_TEMPLATE_ID]: {
    id: DEFAULT_TEMPLATE_ID,
    name: 'Default Book Ad Template',
    dimensions: { width: 1200, height: 628 },
    platform: 'facebook'
  },
  'instagram-story': {
    id: 'instagram-story',
    name: 'Instagram Story Template',
    dimensions: { width: 1080, height: 1920 },
    platform: 'instagram'
  },
  'twitter-post': {
    id: 'twitter-post',
    name: 'Twitter Post Template',
    dimensions: { width: 1200, height: 675 },
    platform: 'twitter'
  },
  'linkedin-post': {
    id: 'linkedin-post',
    name: 'LinkedIn Post Template',
    dimensions: { width: 1200, height: 627 },
    platform: 'linkedin'
  },
};

export function getTemplateById(id?: string): Template {
  if (id && templates[id]) {
    return templates[id];
  }
  return templates[DEFAULT_TEMPLATE_ID];
}

export function getAllTemplates(): Template[] {
  return Object.values(templates);
}

export function getTemplatesByPlatform(platform: Template['platform']): Template[] {
  return Object.values(templates).filter(t => t.platform === platform);
}

