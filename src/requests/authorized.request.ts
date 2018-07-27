import { Request } from 'express';
import { User } from '../entities/user';

export interface AuthorizedRequest extends Request {
  user?: User;
}
