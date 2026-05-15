'use client';

import { FC } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { Input } from '@gitroom/react/form/input';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { Select } from '@gitroom/react/form/select';
import { NaverBlogDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/naver-blog.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const NaverBlogSettings: FC = () => {
  const t = useT();
  const form = useSettings();
  return (
    <>
      <Input label="Title" {...form.register('title')} />
      <Input
        label={t('category_id', 'Category ID')}
        placeholder="Numeric category ID (use bridge /naver/list-categories to discover)"
        {...form.register('categoryId')}
      />
      <Select label={t('visibility', 'Visibility')} {...form.register('visibility')}>
        <option value="public">Public (전체공개)</option>
        <option value="mutual">Mutual (이웃공개)</option>
        <option value="private">Private (비공개)</option>
      </Select>
      <Input
        label="Tags"
        placeholder="comma,separated,tags"
        {...form.register('tags')}
      />
    </>
  );
};

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: NaverBlogSettings,
  CustomPreviewComponent: undefined,
  dto: NaverBlogDto,
  checkValidity: undefined,
  maximumCharacters: 100000,
});
