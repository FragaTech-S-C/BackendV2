export const userSafeSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  nickname: true,
  avatar: true,
  role: true,
  status: true,
  phone: true,
  institutionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userWithInstitutionSelect = {
  ...userSafeSelect,
  institution: true,
} as const;

export const userMinimalSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  nickname: true,
  avatar: true,
  role: true,
} as const;

export const userAuthSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  nickname: true,
  avatar: true,
  role: true,
  status: true,
  phone: true,
  institutionId: true,
  refreshToken: true,
  twoFactorSecret: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userWithPasswordSelect = {
  ...userAuthSelect,
  password: true,
} as const;