import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class NaverBlogDto {
  @IsString()
  @MinLength(2)
  @IsDefined()
  title: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'private', 'mutual'])
  visibility?: 'public' | 'private' | 'mutual';

  @IsOptional()
  @IsString()
  tags?: string;
}
