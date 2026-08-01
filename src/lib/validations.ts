import { z } from 'zod';

export const createSupervisorSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
});

export const createManagementSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
});

export const deactivateSupervisorSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const notifyReversalSchema = z.object({
  adminEmails: z.array(z.string().email()).min(1, 'At least one admin email required'),
  projectName: z.string().min(1),
  floor: z.union([z.string(), z.number()]),
  flatNumber: z.union([z.string(), z.number()]),
  activity: z.string(),
  stage: z.string(),
  stageGate: z.string().optional().default(''),
  oldStatus: z.string(),
  newStatus: z.string(),
});
