import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, MaxLength, IsPhoneNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['email', 'role'] as const)) {
  @ApiPropertyOptional({ example: 'newPassword123', minLength: 8, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @Transform(({ value }) => value === '' || value === null ? undefined : value)
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' || value === null ? undefined : value)
  @MaxLength(500)
  avatar?: string;
}