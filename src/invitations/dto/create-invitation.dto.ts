import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'user-456' })
  @IsString()
  targetUserId: string;

  @ApiProperty({ enum: InvitationType, example: InvitationType.EVENT })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(InvitationType)
  type: InvitationType;

  @ApiPropertyOptional({ example: 'evt_123' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ example: 'Te invitamos al evento' })
  @IsOptional()
  @IsString()
  message?: string;
}
