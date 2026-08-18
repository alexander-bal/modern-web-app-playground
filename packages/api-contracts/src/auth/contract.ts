import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import { loginInputSchema, registerInputSchema, userProfileSchema } from './schemas.js';

const register = oc
  .route({ method: 'POST', path: '/register', successStatus: 201, summary: 'Register new user' })
  .input(registerInputSchema)
  .output(userProfileSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    CONFLICT: commonErrors.CONFLICT,
  });

const login = oc
  .route({ method: 'POST', path: '/login', summary: 'Login' })
  .input(loginInputSchema)
  .output(userProfileSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
  });

const logout = oc
  .route({ method: 'POST', path: '/logout', summary: 'Logout' })
  .output(z.object({ success: z.boolean() }));

const me = oc
  .route({ method: 'GET', path: '/me', summary: 'Get current user' })
  .output(userProfileSchema)
  .errors({
    UNAUTHORIZED: commonErrors.UNAUTHORIZED,
  });

export const authOrpcContract = {
  register,
  login,
  logout,
  me,
};
