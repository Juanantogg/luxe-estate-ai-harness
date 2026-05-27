import { z } from 'zod';

/**
 * Roles que la UI del directorio puede asignar a un usuario. `broker` queda
 * fuera (decisión C2): el enum SQL `user_role` sigue soportándolo pero la
 * UI no expone el rol en tabs/invite/change-role.
 */
export const assignableRoleSchema = z.enum(['user', 'agent', 'admin']);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const changeRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  nextRole: assignableRoleSchema,
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const suspendUserSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const reactivateUserSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type ReactivateUserInput = z.infer<typeof reactivateUserSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  initialRole: assignableRoleSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const resendInvitationSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;
