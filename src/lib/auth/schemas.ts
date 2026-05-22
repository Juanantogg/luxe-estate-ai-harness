import { z } from 'zod';

/**
 * Schemas zod compartidos por las Server Actions de auth y, opcionalmente,
 * por validaciones client-side de la pantalla de login.
 *
 * Diseñados para `FormData` (todos los campos son `string`).
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio.')
  .email('Correo inválido.')
  .max(254, 'Correo demasiado largo.');

/**
 * Contraseña fuerte: mínimo 8 caracteres, al menos 1 letra y 1 número.
 * Aplica a signup y a updatePassword.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede tener más de 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.');

/**
 * Contraseña de login: no validamos complejidad (solo presencia). El check
 * fuerte aplica al signup; ya hay usuarios legacy que podrían no cumplirla.
 */
export const loginPasswordSchema = z.string().min(1, 'La contraseña es obligatoria.');

export const signInSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    fullName: z
      .string()
      .trim()
      .min(2, 'Tu nombre debe tener al menos 2 caracteres.')
      .max(100, 'Tu nombre no puede tener más de 100 caracteres.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const updatePasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const requestResetSchema = z.object({
  email: emailSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
