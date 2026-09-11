import { describe, it, expect } from 'vitest';
import {
  emailSchema, usernameSchema, passwordSchema, fullNameSchema,
  registerSchema, loginSchema, profileUpdateSchema,
  customDialogueSchema, customSceneSchema, youtubeUrlSchema,
  searchQuerySchema, safeValidate,
  type RegisterInput, type LoginInput, type ProfileUpdateInput,
  type CustomSceneInput, type ValidationResult
} from '@/utils/validation';

describe('emailSchema', () => {
  it('should validate correct email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });
  it('should reject short email', () => {
    const result = emailSchema.safeParse('ab@x.y');
    expect(result.success).toBe(false);
  });
  it('should reject invalid format', () => {
    const result = emailSchema.safeParse('notanemail');
    expect(result.success).toBe(false);
  });
  it('should reject empty email', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });
  it('should reject very long email', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = emailSchema.safeParse(longEmail);
    expect(result.success).toBe(false);
  });
  it('should trim and lowercase', () => {
    const result = emailSchema.safeParse('  User@Example.COM  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });
});

describe('usernameSchema', () => {
  it('should validate correct username', () => {
    expect(usernameSchema.safeParse('john_doe').success).toBe(true);
  });
  it('should reject short username', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });
  it('should reject long username', () => {
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });
  it('should reject invalid characters', () => {
    expect(usernameSchema.safeParse('john!').success).toBe(false);
  });
  it('should accept dots, hyphens, underscores', () => {
    expect(usernameSchema.safeParse('john.doe-1').success).toBe(true);
  });
  it('should trim and lowercase', () => {
    const result = usernameSchema.safeParse('  John_Doe  ');
    if (result.success) expect(result.data).toBe('john_doe');
  });
});

describe('passwordSchema', () => {
  it('should validate correct password', () => {
    expect(passwordSchema.safeParse('Password1!').success).toBe(true);
  });
  it('should reject short password', () => {
    expect(passwordSchema.safeParse('Ab1!').success).toBe(false);
  });
  it('should reject password without lowercase', () => {
    expect(passwordSchema.safeParse('PASSWORD1!').success).toBe(false);
  });
  it('should reject password without uppercase', () => {
    expect(passwordSchema.safeParse('password1!').success).toBe(false);
  });
  it('should reject password without digit', () => {
    expect(passwordSchema.safeParse('Password!').success).toBe(false);
  });
  it('should reject password without special char', () => {
    expect(passwordSchema.safeParse('Password1').success).toBe(false);
  });
  it('should reject very long password', () => {
    expect(passwordSchema.safeParse('A'.repeat(99) + '1!').success).toBe(false);
  });
});

describe('fullNameSchema', () => {
  it('should accept valid name', () => {
    expect(fullNameSchema.safeParse('John Doe').success).toBe(true);
  });
  it('should accept empty name (optional)', () => {
    expect(fullNameSchema.safeParse('').success).toBe(true);
  });
  it('should reject very long name', () => {
    expect(fullNameSchema.safeParse('a'.repeat(61)).success).toBe(false);
  });
  it('should transform empty to empty string', () => {
    const result = fullNameSchema.safeParse('');
    if (result.success) expect(result.data).toBe('');
  });
});

describe('registerSchema', () => {
  it('should validate complete registration', () => {
    const data: RegisterInput = {
      username: 'johndoe',
      email: 'john@example.com',
      password: 'Password1!',
      fullName: 'John Doe'
    };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
  it('should reject missing username', () => {
    const data: RegisterInput = {
      username: '',
      email: 'john@example.com',
      password: 'Password1!',
      fullName: 'John'
    };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });
  it('should reject invalid email', () => {
    const data: RegisterInput = {
      username: 'johndoe',
      email: 'bad-email',
      password: 'Password1!',
      fullName: 'John'
    };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('should validate correct login', () => {
    const result = loginSchema.safeParse({ identifier: 'john@example.com', password: 'Password1!' });
    expect(result.success).toBe(true);
  });
  it('should reject short identifier', () => {
    const result = loginSchema.safeParse({ identifier: 'ab', password: 'Password1!' });
    expect(result.success).toBe(false);
  });
  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ identifier: 'john', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('should validate correct profile update', () => {
    const result = profileUpdateSchema.safeParse({ name: 'John', handle: '@johndoe' });
    expect(result.success).toBe(true);
  });
  it('should reject empty name', () => {
    // profileUpdateSchema.name is intentionally min(1): a single-char name
    // like 'J' is valid; only the empty string is rejected.
    expect(profileUpdateSchema.safeParse({ name: '', handle: '@johndoe' }).success).toBe(false);
  });
  it('should reject invalid handle', () => {
    expect(profileUpdateSchema.safeParse({ name: 'John', handle: 'invalid!' }).success).toBe(false);
  });
});

describe('customDialogueSchema', () => {
  it('should validate correct dialogue', () => {
    const result = customDialogueSchema.safeParse({
      character: 'Ali',
      textEn: 'Hello',
      textUz: 'Salom'
    });
    expect(result.success).toBe(true);
  });
  it('should reject empty character', () => {
    expect(customDialogueSchema.safeParse({ character: '', textEn: 'Hi', textUz: 'Salom' }).success).toBe(false);
  });
  it('should reject short text', () => {
    expect(customDialogueSchema.safeParse({ character: 'Ali', textEn: 'H', textUz: 'S' }).success).toBe(false);
  });
});

describe('customSceneSchema', () => {
  it('should validate correct scene', () => {
    const result = customSceneSchema.safeParse({
      movieName: 'Test Movie',
      category: 'Cartoon',
      videoUrl: 'https://example.com/video.mp4',
      dialogues: [{ character: 'Ali', textEn: 'Hello', textUz: 'Salom' }]
    });
    expect(result.success).toBe(true);
  });
  it('should reject invalid category', () => {
    expect(customSceneSchema.safeParse({
      movieName: 'Test', category: 'Invalid', videoUrl: 'https://x.com',
      dialogues: [{ character: 'A', textEn: 'Hi', textUz: 'Salom' }]
    }).success).toBe(false);
  });
  it('should reject scene with no dialogues', () => {
    expect(customSceneSchema.safeParse({
      movieName: 'Test', category: 'Cartoon', videoUrl: 'https://x.com',
      dialogues: []
    }).success).toBe(false);
  });
  it('should accept optional videoUrl', () => {
    const result = customSceneSchema.safeParse({
      movieName: 'Test', category: 'Cartoon', dialogues: [{ character: 'A', textEn: 'Hi', textUz: 'Salom' }]
    });
    expect(result.success).toBe(true);
  });
});

describe('youtubeUrlSchema', () => {
  it('should validate YouTube URL', () => {
    expect(youtubeUrlSchema.safeParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ').success).toBe(true);
  });
  it('should validate short URL', () => {
    expect(youtubeUrlSchema.safeParse('https://youtu.be/dQw4w9WgXcQ').success).toBe(true);
  });
  it('should validate raw video ID', () => {
    expect(youtubeUrlSchema.safeParse('dQw4w9WgXcQ').success).toBe(true);
  });
  it('should reject invalid URL', () => {
    expect(youtubeUrlSchema.safeParse('not a youtube url').success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('should validate and trim query', () => {
    const result = searchQuerySchema.safeParse('  hello world  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('hello world');
  });
  it('should reject too long query', () => {
    expect(searchQuerySchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('safeValidate', () => {
  it('should return success for valid data', () => {
    const result = safeValidate(emailSchema, 'test@example.com');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('test@example.com');
  });
  it('should return error for invalid data', () => {
    const result = safeValidate(emailSchema, 'bad');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeTruthy();
  });
  it('should return generic error for invalid schema input', () => {
    const result = safeValidate(emailSchema, null);
    expect(result.success).toBe(false);
  });
});
