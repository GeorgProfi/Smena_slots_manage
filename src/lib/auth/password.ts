export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`;
  }
  return null;
}
