import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiPropertyOptional({ example: 'personal' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'Yo' })
  @IsOptional()
  @IsString()
  leader?: string;

  @ApiPropertyOptional({ type: [String], example: ['user-1', 'user-2'] })
  @IsOptional()
  members?: string[];

  @ApiProperty({ example: 'Tech Enthusiasts' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Group for technology enthusiasts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  requiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionId?: string;
}