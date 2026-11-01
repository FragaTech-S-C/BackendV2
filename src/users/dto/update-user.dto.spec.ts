import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('accepts optional avatar and blank phone values', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      firstName: 'Alice',
      avatar: 'https://cdn.example.com/avatar.png',
      phone: '',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto.avatar).toBe('https://cdn.example.com/avatar.png');
  });
});
